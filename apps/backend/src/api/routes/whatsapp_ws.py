"""
Rota WebSocket para o Inbox do WhatsApp.
Endpoint: GET /api/v1/whatsapp/ws/{account_id}?token=<JWT>

O frontend conecta aqui e recebe eventos em tempo real:
  - message.new       → nova mensagem recebida
  - message.update    → status de mensagem atualizado
  - connection.update → status da conta mudou
  - ws_connected      → Evolution WS conectado com sucesso
"""
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.auth.repository import is_jti_revoked
from src.auth.service import decode_access_token
from src.db.models_whatsapp import WhatsAppAccount
from src.db.session import SessionLocal
from src.organizations.service import get_membership_role
from src.providers.whatsapp.encryption import decrypt_api_key
from src.ws.connection_manager import ws_manager
from src.ws.registry import evolution_registry

logger = logging.getLogger("completepay.ws.whatsapp")

router = APIRouter(tags=["whatsapp-ws"])

_ALLOWED_ROLES = {"rcp", "enf", "mkt", "gcl", "owner"}


async def _close_ws(websocket: WebSocket, code: int, reason: str) -> None:
    """Aceita e fecha conexão WS com código de erro."""
    try:
        await websocket.accept()
    except Exception:
        pass
    await websocket.close(code=code, reason=reason)


@router.websocket("/api/v1/whatsapp/ws/{account_id}")
async def whatsapp_inbox_ws(account_id: str, websocket: WebSocket) -> None:
    """
    WebSocket do Inbox WhatsApp.
    Autenticação via query param: ?token=<JWT>
    """
    token = (websocket.query_params.get("token") or "").strip()
    if not token:
        await _close_ws(websocket, code=4001, reason="Token ausente")
        return

    try:
        payload = decode_access_token(token)
    except Exception:
        await _close_ws(websocket, code=4001, reason="Token inválido")
        return

    user_id = payload.get("sub")
    if not user_id:
        await _close_ws(websocket, code=4001, reason="Token inválido")
        return

    jti = payload.get("jti")
    if jti and is_jti_revoked(str(jti)):
        await _close_ws(websocket, code=4001, reason="Sessão revogada")
        return

    db = SessionLocal()
    try:
        account = db.query(WhatsAppAccount).filter(
            WhatsAppAccount.id == account_id,
            WhatsAppAccount.is_deleted.is_(False),
        ).first()
        if not account:
            await _close_ws(websocket, code=4404, reason="Conta não encontrada")
            return

        role = get_membership_role(db, str(user_id), str(account.organization_id))
        if role is None or str(role).strip().lower() not in _ALLOWED_ROLES:
            await _close_ws(websocket, code=4003, reason="Acesso negado")
            return
    finally:
        db.close()

    # Garante cliente Evolution WS ativo quando o inbox é aberto.
    # Isso evita depender apenas do startup/status sincronizado.
    if account.provider == "evolution" and account.api_base_url and account.instance_name:
        try:
            api_key = decrypt_api_key(account.api_key_encrypted) if account.api_key_encrypted else ""
            if api_key:
                await evolution_registry.start_account(
                    account_id=str(account.id),
                    organization_id=str(account.organization_id),
                    base_url=account.api_base_url,
                    instance_name=account.instance_name,
                    api_key=api_key,
                )
        except Exception as exc:
            logger.warning("Não foi possível garantir Evolution WS account=%s: %s", account_id, exc)

    await ws_manager.connect(account_id, websocket)
    logger.info("Inbox WS conectado: account=%s user=%s", account_id, user_id)

    try:
        # Manter conexão aberta; responder a pings do cliente
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("Erro no WS Inbox account=%s: %s", account_id, exc)
    finally:
        await ws_manager.disconnect(account_id, websocket)
        logger.info("Inbox WS desconectado: account=%s", account_id)
