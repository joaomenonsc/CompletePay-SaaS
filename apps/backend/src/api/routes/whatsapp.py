"""
Rotas autenticadas do módulo WhatsApp.
Prefixo: /api/v1/whatsapp
RBAC: usa require_org_role da deps.py.
"""
import hashlib
import hmac
import logging
import re
import secrets
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request
from sqlalchemy.orm import Session

from src.api.deps import get_db, require_org_role
from src.api.middleware.auth import require_user_id
from src.config.settings import get_settings
from src.db.models_whatsapp import WhatsAppAccount
from src.schemas.whatsapp import (
    AISuggestReplyResponse,
    AISummarizeResponse,
    CampaignProgressResponse,
    ConversationUpdateSchema,
    MessageSendTemplateSchema,
    MessageSendTextSchema,
    PreviewRecipientsResponse,
    QRCodeResponse,
    WhatsAppAccountCreate,
    WhatsAppAccountListResponse,
    WhatsAppAccountResponse,
    WhatsAppAccountUpdate,
    WhatsAppAutomationTriggerCreate,
    WhatsAppAutomationTriggerListResponse,
    WhatsAppAutomationTriggerResponse,
    WhatsAppAutomationTriggerUpdate,
    WhatsAppCampaignCreate,
    WhatsAppCampaignListResponse,
    WhatsAppCampaignResponse,
    WhatsAppConversationListResponse,
    WhatsAppConversationResponse,
    WhatsAppMessageListResponse,
    WhatsAppMessageResponse,
    WhatsAppMetricsResponse,
    WhatsAppTemplateCreate,
    WhatsAppTemplateListResponse,
    WhatsAppTemplateResponse,
    WhatsAppTemplateUpdate,
)
from src.services import whatsapp_service, whatsapp_campaign_service

logger = logging.getLogger("completepay.whatsapp.routes")

router = APIRouter(
    prefix="/api/v1/whatsapp",
    tags=["whatsapp"],
)

# Aliases de roles para legibilidade
_OWNER_ROLES = ["gcl", "owner"]
_MKT_ROLES = ["mkt", "gcl", "owner"]
_ATENDENTE_ROLES = ["rcp", "enf", "gcl", "mkt", "owner"]


def _build_default_instance_name(
    *,
    phone_number: str,
    organization_id: str,
) -> str:
    """
    Gera instance_name estável para contas criadas sem campo técnico no frontend.
    """
    digits = re.sub(r"\D", "", phone_number or "")
    org_fragment = re.sub(r"[^a-z0-9]", "", (organization_id or "").lower())[:8] or "org"
    phone_fragment = digits[-12:] if digits else secrets.token_hex(6)
    settings = get_settings()
    prefix_raw = (settings.whatsapp_instance_prefix or "cp").strip().lower()
    prefix = re.sub(r"[^a-z0-9-]", "", prefix_raw) or "cp"
    return f"{prefix}-{org_fragment}-{phone_fragment}"[:128]


def _configure_evolution_instance(
    *,
    account: WhatsAppAccount,
    api_key: str,
    webhook_url: str,
    webhook_secret: Optional[str],
) -> None:
    """
    Best-effort: configura webhook e websocket da instância Evolution.
    Não interrompe o fluxo principal em caso de falha remota.
    """
    base_url = (account.api_base_url or "").rstrip("/")
    instance_name = (account.instance_name or "").strip()
    if not base_url or not instance_name or not api_key:
        return

    headers = {
        "Content-Type": "application/json",
        "apikey": api_key,
    }
    ws_events = ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]

    try:
        with httpx.Client(timeout=10.0) as client:
            # Websocket events (não depende de webhook secret)
            ws_resp = client.post(
                f"{base_url}/websocket/set/{instance_name}",
                headers=headers,
                json={"websocket": {"enabled": True, "events": ws_events}},
            )
            if not (200 <= ws_resp.status_code < 300):
                logger.warning(
                    "Auto-config Evolution websocket/set falhou: account=%s status=%s body=%s",
                    account.id,
                    ws_resp.status_code,
                    ws_resp.text[:200],
                )

            # Webhook: só atualiza header se tivermos o secret raw
            if webhook_secret:
                wh_resp = client.post(
                    f"{base_url}/webhook/set/{instance_name}",
                    headers=headers,
                    json={
                        "webhook": {
                            "url": webhook_url,
                            "enabled": True,
                            "events": ws_events,
                            "headers": {"X-Webhook-Secret": webhook_secret},
                            "webhookByEvents": False,
                            "webhookBase64": False,
                        }
                    },
                )
                if not (200 <= wh_resp.status_code < 300):
                    logger.warning(
                        "Auto-config Evolution webhook/set falhou: account=%s status=%s body=%s",
                        account.id,
                        wh_resp.status_code,
                        wh_resp.text[:200],
                    )
    except Exception as exc:
        logger.warning(
            "Auto-config Evolution indisponível: account=%s instance=%s err=%s",
            account.id,
            instance_name,
            exc,
        )


# ===========================================================================
# Contas WhatsApp
# ===========================================================================

@router.get("/accounts", response_model=WhatsAppAccountListResponse)
def list_accounts(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_ATENDENTE_ROLES)),
    user_id: str = Depends(require_user_id),
):
    """Lista contas WhatsApp da organização. [rcp, enf, gcl, mkt, owner]"""
    items, total = whatsapp_service.list_accounts(db, organization_id, offset, limit)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/accounts", response_model=WhatsAppAccountResponse, status_code=201)
def create_account(
    body: WhatsAppAccountCreate,
    request: Request,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_OWNER_ROLES)),
    user_id: str = Depends(require_user_id),
):
    """Cria nova conta WhatsApp. [gcl, owner]"""
    try:
        settings = get_settings()
        effective_provider = (body.provider or "evolution").strip().lower()
        effective_instance_name = body.instance_name
        effective_api_base_url = body.api_base_url
        effective_api_key = body.api_key

        if effective_provider == "evolution":
            effective_instance_name = (
                body.instance_name
                or _build_default_instance_name(
                    phone_number=body.phone_number,
                    organization_id=organization_id,
                )
            )
            effective_api_base_url = (
                body.api_base_url
                or settings.whatsapp_evolution_base_url
                or ""
            ).strip()
            effective_api_key = (
                body.api_key
                or settings.whatsapp_evolution_api_key
                or ""
            ).strip()

            if not effective_api_base_url or not effective_api_key:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Configuração WhatsApp indisponível no ambiente. "
                        "Contate o suporte."
                    ),
                )

        # Onboarding zero-touch para Evolution:
        # se não vier secret, gera um automaticamente para webhook auth.
        effective_webhook_secret = body.webhook_secret
        if effective_provider == "evolution" and not effective_webhook_secret:
            effective_webhook_secret = secrets.token_hex(24)

        account = whatsapp_service.create_account(
            db=db,
            organization_id=organization_id,
            display_name=body.display_name,
            phone_number=body.phone_number,
            provider=effective_provider,
            instance_name=effective_instance_name,
            api_base_url=effective_api_base_url,
            api_key=effective_api_key,
            webhook_secret=effective_webhook_secret,
            is_default=body.is_default,
            created_by=user_id,
        )
        db.commit()
        db.refresh(account)

        if (
            account.provider == "evolution"
            and effective_api_key
            and account.instance_name
            and account.api_base_url
        ):
            webhook_url = str(request.url_for("receive_webhook", account_id=str(account.id)))
            _configure_evolution_instance(
                account=account,
                api_key=effective_api_key,
                webhook_url=webhook_url,
                webhook_secret=effective_webhook_secret,
            )

        return account
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        from sqlalchemy.exc import IntegrityError
        if isinstance(e, IntegrityError):
            db.rollback()
            detail = str(e.orig) if hasattr(e, "orig") else str(e)
            raise HTTPException(status_code=400, detail=f"Erro de integridade: {detail}")
        logger.exception("Erro inesperado ao criar conta WhatsApp")
        raise HTTPException(status_code=500, detail="Erro interno ao criar conta.")


@router.get("/accounts/{account_id}", response_model=WhatsAppAccountResponse)
def get_account(
    account_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_OWNER_ROLES)),
):
    """Detalhe de uma conta. [gcl, owner]"""
    account = whatsapp_service.get_account(db, account_id, organization_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    return account


@router.patch("/accounts/{account_id}", response_model=WhatsAppAccountResponse)
def update_account(
    account_id: str,
    body: WhatsAppAccountUpdate,
    request: Request,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_OWNER_ROLES)),
):
    """Atualiza conta WhatsApp. [gcl, owner]"""
    account = whatsapp_service.get_account(db, account_id, organization_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    try:
        settings = get_settings()
        whatsapp_service.update_account(
            db=db,
            account=account,
            display_name=body.display_name,
            instance_name=body.instance_name,
            api_base_url=body.api_base_url,
            api_key=body.api_key,
            webhook_secret=body.webhook_secret,
            is_default=body.is_default,
        )
        db.commit()
        db.refresh(account)

        if account.provider == "evolution" and account.instance_name and account.api_base_url:
            from src.providers.whatsapp.encryption import decrypt_api_key
            api_key = (
                body.api_key
                or (decrypt_api_key(account.api_key_encrypted) if account.api_key_encrypted else "")
                or settings.whatsapp_evolution_api_key
                or ""
            )
            webhook_url = str(request.url_for("receive_webhook", account_id=str(account.id)))
            _configure_evolution_instance(
                account=account,
                api_key=api_key,
                webhook_url=webhook_url,
                webhook_secret=body.webhook_secret,  # só temos raw no request atual
            )

        return account
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(
    account_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_OWNER_ROLES)),
):
    """Remove (soft-delete) uma conta. [gcl, owner] Falha se houver conversas abertas."""
    account = whatsapp_service.get_account(db, account_id, organization_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    try:
        whatsapp_service.delete_account(db, account)
        db.commit()
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/accounts/{account_id}/qrcode", response_model=QRCodeResponse)
def get_qrcode(
    account_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_OWNER_ROLES)),
):
    """Retorna QR Code para conexão da conta (Evolution API). [gcl, owner]"""
    from src.providers.whatsapp.factory import get_whatsapp_provider
    account = whatsapp_service.get_account(db, account_id, organization_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    try:
        provider = get_whatsapp_provider(account)
        qr = provider.get_qrcode(account.instance_name or "")
        status = "available" if qr else "pending"
        return QRCodeResponse(
            account_id=account_id,
            qrcode_base64=qr,
            status=status,
        )
    except Exception as e:
        return QRCodeResponse(
            account_id=account_id,
            status="error",
            message=str(e),
        )


@router.post("/accounts/{account_id}/sync-status", response_model=WhatsAppAccountResponse)
async def sync_account_status(
    account_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_OWNER_ROLES)),
):
    """Sincroniza o status da conta consultando o connectionState no provider. [gcl, owner]"""
    from src.providers.whatsapp.factory import get_whatsapp_provider
    account = whatsapp_service.get_account(db, account_id, organization_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    try:
        provider = get_whatsapp_provider(account)
        health = provider.health()
        state = (health.get("state") or "").lower()
        status_map = {
            "open": "connected",
            "close": "disconnected",
            "connecting": "pending",
        }
        new_status = status_map.get(state, "disconnected")
        account.status = new_status
        db.commit()
        db.refresh(account)
        logger.info(
            "sync-status: account=%s state=%s -> status=%s",
            account_id, state, new_status,
        )
        # Auto-iniciar cliente WS se conectado
        if new_status == "connected" and account.provider == "evolution":
            from src.ws.registry import evolution_registry
            from src.providers.whatsapp.encryption import decrypt_api_key
            try:
                api_key = decrypt_api_key(account.api_key_encrypted) if account.api_key_encrypted else ""
                if api_key:
                    await evolution_registry.start_account(
                        account_id=str(account.id),
                        organization_id=str(account.organization_id),
                        base_url=account.api_base_url or "",
                        instance_name=account.instance_name or "",
                        api_key=api_key,
                    )
                    logger.info("Evolution WS client garantido para account=%s", account_id)
            except Exception as ws_exc:
                logger.warning("Não foi possível iniciar WS client: %s", ws_exc)
    except Exception as e:
        logger.warning("sync-status falhou para conta %s: %s", account_id, e)
    return account


@router.post("/accounts/{account_id}/webhook-secret", response_model=dict)
def rotate_webhook_secret(
    account_id: str,
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_OWNER_ROLES)),
):
    """Rotaciona o webhook secret da conta. [gcl, owner]"""
    account = whatsapp_service.get_account(db, account_id, organization_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    new_secret = body.get("webhook_secret", "")
    if not new_secret:
        raise HTTPException(status_code=422, detail="webhook_secret é obrigatório.")
    account.webhook_secret_hash = hashlib.sha256(new_secret.encode()).hexdigest()
    db.commit()

    if account.provider == "evolution" and account.instance_name and account.api_base_url and account.api_key_encrypted:
        from src.providers.whatsapp.encryption import decrypt_api_key
        api_key = decrypt_api_key(account.api_key_encrypted)
        webhook_url = str(request.url_for("receive_webhook", account_id=str(account.id)))
        _configure_evolution_instance(
            account=account,
            api_key=api_key,
            webhook_url=webhook_url,
            webhook_secret=new_secret,
        )

    return {"status": "ok", "message": "Webhook secret atualizado."}


# ===========================================================================
# Webhook público — Evolution API
# ===========================================================================

@router.post("/webhook/{account_id}", include_in_schema=True)
async def receive_webhook(
    account_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    x_webhook_secret: str | None = Header(None, alias="X-Webhook-Secret"),
    x_evolution_webhook_secret: str | None = Header(None, alias="X-Evolution-Webhook-Secret"),
):
    """
    Endpoint público (sem JWT) para receber eventos do Evolution API.
    URL a configurar no Evolution: https://<seu-backend>/api/v1/whatsapp/webhook/{account_id}
    """

    # Buscar a conta sem filtrar por org (webhook é público)
    account = db.query(WhatsAppAccount).filter(
        WhatsAppAccount.id == account_id,
        WhatsAppAccount.is_deleted.is_(False),
    ).first()
    if not account:
        logger.warning("Webhook recebido para conta desconhecida: %s", account_id)
        return {"status": "ignored", "reason": "account_not_found"}

    # Validar segredo simples (sha256 do header) quando configurado na conta.
    if account.webhook_secret_hash:
        provided = (x_webhook_secret or x_evolution_webhook_secret or "").strip()
        if not provided:
            raise HTTPException(status_code=400, detail="Header de assinatura obrigatório.")
        provided_hash = hashlib.sha256(provided.encode()).hexdigest()
        if not hmac.compare_digest(provided_hash, account.webhook_secret_hash):
            raise HTTPException(status_code=400, detail="Assinatura de webhook inválida.")

    org_id = account.organization_id
    event = payload.get("event", "")

    logger.info("Webhook Evolution: account=%s event=%s", account_id, event)

    # ── connection.update — atualiza status da conta ────────────────────────
    if event == "connection.update":
        from src.providers.whatsapp.encryption import decrypt_api_key
        from src.ws.connection_manager import ws_manager
        from src.ws.registry import evolution_registry

        data = payload.get("data", {})
        state = (data.get("state") or data.get("connection") or "").lower()
        status_map = {"open": "connected", "close": "disconnected", "connecting": "pending"}
        new_status = status_map.get(state, "disconnected")
        account.status = new_status
        db.commit()

        if account.provider == "evolution":
            if new_status == "connected":
                api_key = decrypt_api_key(account.api_key_encrypted) if account.api_key_encrypted else ""
                if api_key:
                    await evolution_registry.start_account(
                        account_id=str(account.id),
                        organization_id=str(account.organization_id),
                        base_url=account.api_base_url or "",
                        instance_name=account.instance_name or "",
                        api_key=api_key,
                    )
            elif new_status in {"disconnected", "error"}:
                await evolution_registry.stop_account(str(account.id))

        await ws_manager.broadcast(str(account_id), {
            "type": "connection.update",
            "account_id": str(account_id),
            "status": new_status,
        })
        logger.info("connection.update: account=%s state=%s -> %s", account_id, state, new_status)
        return {"status": "ok"}

    # ── messages.upsert — mensagem recebida ────────────────────────────────
    if event in ("messages.upsert", "message.received"):
        from src.providers.whatsapp.evolution import _extract_phone_from_evolution_payload

        data = payload.get("data", {})
        payload_sender = payload.get("sender")
        # Evolution pode enviar lista ou objeto único
        items = data if isinstance(data, list) else [data]

        processed = 0
        for item in items:
            key = item.get("key", {})
            # Ignorar mensagens enviadas por nós
            if key.get("fromMe", False):
                continue

            phone_normalized = _extract_phone_from_evolution_payload(
                key=key,
                sender=payload_sender,
            )
            if not phone_normalized:
                logger.warning(
                    "Webhook Evolution sem telefone mapeável: account=%s key=%s",
                    account_id,
                    key,
                )
                continue

            msg_type = item.get("messageType", "text").lower()
            type_map = {
                "conversation": "text",
                "extendedtextmessage": "text",
                "imagemessage": "image",
                "audiomessage": "audio",
                "videomessage": "video",
                "documentmessage": "document",
                "stickermessage": "sticker",
                "locationmessage": "location",
                "templatemessage": "template",
            }
            mapped_type = type_map.get(msg_type, "text")

            message = item.get("message", {})
            body_text = (
                message.get("conversation")
                or message.get("extendedTextMessage", {}).get("text")
                or message.get("caption")
                or None
            )
            media_url = message.get("url") or None
            external_id = key.get("id", "") or f"evo-{phone_normalized}-{processed}"
            display_name = item.get("pushName") or None

            try:
                msg = whatsapp_service.record_inbound_message(
                    db=db,
                    organization_id=org_id,
                    account=account,
                    external_message_id=external_id,
                    phone=phone_normalized,
                    message_type=mapped_type,
                    body_text=body_text,
                    media_url=media_url,
                    display_name=display_name,
                    provider_metadata=item,
                )
                if msg:
                    processed += 1
            except Exception as exc:
                logger.error("Erro ao processar mensagem do webhook: %s", exc)

        db.commit()
        return {"status": "ok", "processed": processed}

    # Eventos desconhecidos — ignorar silenciosamente
    return {"status": "ignored", "event": event}


# ===========================================================================
# Conversas
# ===========================================================================

@router.get("/conversations", response_model=WhatsAppConversationListResponse)
def list_conversations(
    status: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_ATENDENTE_ROLES)),
):
    """Inbox de conversas com filtros. [rcp, enf, gcl, mkt, owner]"""
    items, total = whatsapp_service.get_conversations_inbox(
        db, organization_id,
        status=status,
        assigned_to=assigned_to,
        account_id=account_id,
        offset=offset,
        limit=limit,
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/conversations/{conversation_id}", response_model=WhatsAppConversationResponse)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_ATENDENTE_ROLES)),
):
    """Detalhe de uma conversa. [rcp, enf, gcl, mkt, owner]"""
    conv = whatsapp_service.get_conversation(db, conversation_id, organization_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")
    return conv


@router.patch("/conversations/{conversation_id}", response_model=WhatsAppConversationResponse)
def update_conversation(
    conversation_id: str,
    body: ConversationUpdateSchema,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_ATENDENTE_ROLES)),
):
    """Atualiza status, assigned_to ou tags de uma conversa. [rcp, enf, gcl, mkt, owner]"""
    conv = whatsapp_service.get_conversation(db, conversation_id, organization_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")
    whatsapp_service.update_conversation(
        db, conv,
        status=body.status,
        assigned_to=body.assigned_to,
        tags=body.tags,
        sla_deadline=body.sla_deadline,
    )
    db.commit()
    db.refresh(conv)
    return conv


# ===========================================================================
# Mensagens
# ===========================================================================

@router.get("/conversations/{conversation_id}/messages", response_model=WhatsAppMessageListResponse)
def list_messages(
    conversation_id: str,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_ATENDENTE_ROLES)),
):
    """Histórico de mensagens de uma conversa. [rcp, enf, gcl, mkt, owner]"""
    conv = whatsapp_service.get_conversation(db, conversation_id, organization_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")
    items, total = whatsapp_service.get_messages(
        db, organization_id, conversation_id, offset, limit
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post(
    "/conversations/{conversation_id}/messages/text",
    response_model=WhatsAppMessageResponse,
    status_code=201,
)
def send_text_message(
    conversation_id: str,
    body: MessageSendTextSchema,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(["rcp", "enf", "gcl", "owner"])),
    user_id: str = Depends(require_user_id),
):
    """Envia mensagem de texto em uma conversa. [rcp, enf, gcl, owner]"""
    conv = whatsapp_service.get_conversation(db, conversation_id, organization_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")

    account = whatsapp_service.get_account(db, conv.account_id, organization_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta WhatsApp da conversa não encontrada.")

    try:
        msg = whatsapp_service.send_text_message(db, account, conv, body.body_text, user_id)
        db.commit()
        db.refresh(msg)
        return msg
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post(
    "/conversations/{conversation_id}/messages/template",
    response_model=WhatsAppMessageResponse,
    status_code=201,
)
def send_template_message(
    conversation_id: str,
    body: MessageSendTemplateSchema,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(["rcp", "enf", "gcl", "owner"])),
    user_id: str = Depends(require_user_id),
):
    """Envia mensagem de template aprovado em uma conversa. [rcp, enf, gcl, owner]"""
    conv = whatsapp_service.get_conversation(db, conversation_id, organization_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")

    account = whatsapp_service.get_account(db, conv.account_id, organization_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta WhatsApp da conversa não encontrada.")

    template = whatsapp_service.get_template(db, body.template_id, organization_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado.")

    try:
        msg = whatsapp_service.send_template_message(
            db, account, conv, template, body.variables, user_id
        )
        db.commit()
        db.refresh(msg)
        return msg
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ===========================================================================
# Templates
# ===========================================================================

@router.get("/templates", response_model=WhatsAppTemplateListResponse)
def list_templates(
    status: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
):
    """Lista templates. [mkt, gcl, owner]"""
    items, total = whatsapp_service.list_templates(
        db, organization_id, status=status, account_id=account_id,
        offset=offset, limit=limit,
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/templates", response_model=WhatsAppTemplateResponse, status_code=201)
def create_template(
    body: WhatsAppTemplateCreate,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
    user_id: str = Depends(require_user_id),
):
    """Cria template (status DRAFT). [mkt, gcl, owner]"""
    template = whatsapp_service.create_template(
        db=db,
        organization_id=organization_id,
        name=body.name,
        category=body.category,
        language=body.language,
        body_text=body.body_text,
        account_id=body.account_id,
        header_type=body.header_type,
        header_content=body.header_content,
        footer_text=body.footer_text,
        variables=body.variables,
        buttons=body.buttons,
        created_by=user_id,
    )
    db.commit()
    db.refresh(template)
    return template


@router.get("/templates/{template_id}", response_model=WhatsAppTemplateResponse)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
):
    """Detalhe de um template. [mkt, gcl, owner]"""
    template = whatsapp_service.get_template(db, template_id, organization_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado.")
    return template


@router.patch("/templates/{template_id}", response_model=WhatsAppTemplateResponse)
def update_template(
    template_id: str,
    body: WhatsAppTemplateUpdate,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
    user_id: str = Depends(require_user_id),
):
    """Atualiza template (apenas se DRAFT). [mkt, gcl, owner]"""
    template = whatsapp_service.get_template(db, template_id, organization_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado.")
    from src.db.models_whatsapp import TemplateStatus
    if template.status != TemplateStatus.DRAFT:
        raise HTTPException(
            status_code=409,
            detail=f"Template com status '{template.status}' não pode ser editado. Apenas DRAFT."
        )
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(template, field, value)
    db.commit()
    db.refresh(template)
    return template


@router.post("/templates/{template_id}/submit", response_model=WhatsAppTemplateResponse)
def submit_template(
    template_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
    user_id: str = Depends(require_user_id),
):
    """Submete template para aprovação (DRAFT → PENDING_REVIEW). [mkt, gcl, owner]"""
    template = whatsapp_service.get_template(db, template_id, organization_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado.")
    try:
        whatsapp_service.submit_template(db, template, user_id)
        db.commit()
        db.refresh(template)
        return template
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/templates/{template_id}/approve", response_model=WhatsAppTemplateResponse)
def approve_template(
    template_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_OWNER_ROLES)),
):
    """Aprova template (PENDING_REVIEW → APPROVED). [gcl, owner]"""
    template = whatsapp_service.get_template(db, template_id, organization_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado.")
    whatsapp_service.approve_template(db, template)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
):
    """Soft-delete de template. [mkt, gcl, owner]"""
    template = whatsapp_service.get_template(db, template_id, organization_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado.")
    template.is_deleted = True
    db.commit()


# ===========================================================================
# Campanhas
# ===========================================================================

@router.get("/campaigns/preview-recipients", response_model=PreviewRecipientsResponse)
def preview_recipients(
    tags: Optional[str] = Query(None, description="Tags separadas por vírgula"),
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
):
    """Preview dos contatos elegíveis antes de iniciar campanha. [mkt, gcl, owner]"""
    segment_filter = {}
    if tags:
        segment_filter["tags"] = [t.strip() for t in tags.split(",") if t.strip()]
    result = whatsapp_campaign_service.preview_recipients(
        db, organization_id, segment_filter=segment_filter or None
    )
    return result


@router.get("/campaigns", response_model=WhatsAppCampaignListResponse)
def list_campaigns(
    status: Optional[str] = Query(None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
):
    """Lista campanhas. [mkt, gcl, owner]"""
    items, total = whatsapp_campaign_service.list_campaigns(
        db, organization_id, status=status, offset=offset, limit=limit
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/campaigns", response_model=WhatsAppCampaignResponse, status_code=201)
def create_campaign(
    body: WhatsAppCampaignCreate,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
    user_id: str = Depends(require_user_id),
):
    """Cria campanha (status DRAFT). [mkt, gcl, owner]"""
    try:
        campaign = whatsapp_campaign_service.create_campaign(
            db=db,
            organization_id=organization_id,
            account_id=body.account_id,
            name=body.name,
            template_id=body.template_id,
            template_variables_default=body.template_variables_default,
            segment_filter=body.segment_filter,
            scheduled_at=body.scheduled_at,
            messages_per_minute=body.messages_per_minute,
            created_by=user_id,
        )
        db.commit()
        db.refresh(campaign)
        return campaign
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/campaigns/{campaign_id}", response_model=WhatsAppCampaignResponse)
def get_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
):
    """Detalhe de uma campanha. [mkt, gcl, owner]"""
    campaign = whatsapp_campaign_service.get_campaign(db, campaign_id, organization_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada.")
    return campaign


@router.post("/campaigns/{campaign_id}/start", response_model=WhatsAppCampaignResponse)
def start_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
):
    """Inicia campanha: constrói recipients e dispara execução assíncrona. [mkt, gcl, owner]"""
    campaign = whatsapp_campaign_service.get_campaign(db, campaign_id, organization_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada.")
    try:
        whatsapp_campaign_service.build_recipient_list(db, campaign)
        db.commit()
        # Execução assíncrona em background
        background_tasks.add_task(
            whatsapp_campaign_service.execute_campaign,
            campaign_id=campaign_id,
            organization_id=organization_id,
        )
        db.refresh(campaign)
        return campaign
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/campaigns/{campaign_id}/pause", response_model=WhatsAppCampaignResponse)
def pause_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
):
    """Pausa campanha RUNNING. [mkt, gcl, owner]"""
    campaign = whatsapp_campaign_service.get_campaign(db, campaign_id, organization_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada.")
    try:
        whatsapp_campaign_service.pause_campaign(db, campaign)
        db.commit()
        db.refresh(campaign)
        return campaign
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/campaigns/{campaign_id}/progress", response_model=CampaignProgressResponse)
def get_campaign_progress(
    campaign_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
):
    """Progresso de execução de campanha (polling). [mkt, gcl, owner]"""
    campaign = whatsapp_campaign_service.get_campaign(db, campaign_id, organization_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campanha não encontrada.")
    return whatsapp_campaign_service.get_campaign_progress(db, campaign)


# ===========================================================================
# Automation Triggers
# ===========================================================================

@router.get("/automation-triggers", response_model=WhatsAppAutomationTriggerListResponse)
def list_triggers(
    account_id: Optional[str] = Query(None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_OWNER_ROLES)),
):
    """Lista triggers de automação. [gcl, owner]"""
    items, total = whatsapp_service.list_automation_triggers(
        db, organization_id, account_id=account_id, offset=offset, limit=limit
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/automation-triggers", response_model=WhatsAppAutomationTriggerResponse, status_code=201)
def create_trigger(
    body: WhatsAppAutomationTriggerCreate,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_OWNER_ROLES)),
    user_id: str = Depends(require_user_id),
):
    """Cria trigger de automação WhatsApp. [gcl, owner]"""
    # Verificar que a conta pertence à org
    account = whatsapp_service.get_account(db, body.account_id, organization_id)
    if not account:
        raise HTTPException(status_code=404, detail="Conta WhatsApp não encontrada.")

    trigger = whatsapp_service.create_automation_trigger(
        db=db,
        organization_id=organization_id,
        account_id=body.account_id,
        name=body.name,
        event_type=body.event_type,
        workflow_id=body.workflow_id,
        conditions=body.conditions,
        is_active=body.is_active,
        priority=body.priority,
        created_by=user_id,
    )
    db.commit()
    db.refresh(trigger)
    return trigger


@router.patch("/automation-triggers/{trigger_id}", response_model=WhatsAppAutomationTriggerResponse)
def update_trigger(
    trigger_id: str,
    body: WhatsAppAutomationTriggerUpdate,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_OWNER_ROLES)),
):
    """Atualiza trigger. [gcl, owner]"""
    from src.db.models_whatsapp import WhatsAppAutomationTrigger
    trigger = db.query(WhatsAppAutomationTrigger).filter(
        WhatsAppAutomationTrigger.id == trigger_id,
        WhatsAppAutomationTrigger.organization_id == organization_id,
    ).first()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger não encontrado.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(trigger, field, value)
    db.commit()
    db.refresh(trigger)
    return trigger


@router.delete("/automation-triggers/{trigger_id}", status_code=204)
def delete_trigger(
    trigger_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_OWNER_ROLES)),
):
    """Deleta trigger. [gcl, owner]"""
    from src.db.models_whatsapp import WhatsAppAutomationTrigger
    trigger = db.query(WhatsAppAutomationTrigger).filter(
        WhatsAppAutomationTrigger.id == trigger_id,
        WhatsAppAutomationTrigger.organization_id == organization_id,
    ).first()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger não encontrado.")
    db.delete(trigger)
    db.commit()


# ===========================================================================
# Métricas
# ===========================================================================

@router.get("/metrics/overview", response_model=WhatsAppMetricsResponse)
def get_metrics(
    period: str = Query(default="7d", pattern="^(1d|7d|30d|90d)$"),
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_MKT_ROLES)),
):
    """Dashboard de métricas WhatsApp. [mkt, gcl, owner]"""
    period_days_map = {"1d": 1, "7d": 7, "30d": 30, "90d": 90}
    days = period_days_map.get(period, 7)
    metrics = whatsapp_service.get_metrics_overview(db, organization_id, days)
    return metrics


# ===========================================================================
# AI Copilot (WA-7.x — fallback gracioso se sem OPENAI_API_KEY)
# ===========================================================================

@router.get(
    "/conversations/{conversation_id}/ai/suggest-reply",
    response_model=AISuggestReplyResponse,
)
def suggest_reply(
    conversation_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_ATENDENTE_ROLES)),
):
    """Sugestão de resposta por IA para última mensagem. [rcp, enf, gcl, mkt, owner]"""
    from src.services import whatsapp_ai_service
    result = whatsapp_ai_service.suggest_reply(db, conversation_id, organization_id)
    return {
        "conversation_id": conversation_id,
        "suggested_reply": result.get("suggested_reply"),
        "available": result.get("available", False),
    }


@router.get(
    "/conversations/{conversation_id}/ai/summarize",
    response_model=AISummarizeResponse,
)
def summarize_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    organization_id: str = Depends(require_org_role(_ATENDENTE_ROLES)),
):
    """Resumo da conversa por IA. [rcp, enf, gcl, mkt, owner]"""
    from src.services import whatsapp_ai_service
    result = whatsapp_ai_service.summarize_conversation(db, conversation_id, organization_id)
    return {
        "conversation_id": conversation_id,
        "summary": result.get("summary"),
        "available": result.get("available", False),
    }
