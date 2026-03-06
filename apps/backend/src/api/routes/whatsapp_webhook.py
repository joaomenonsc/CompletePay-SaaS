"""
Rotas públicas do webhook WhatsApp.
Autenticação via HMAC-SHA256 (sem JWT).
Endpoint registrado em PUBLIC_ROUTES em auth.py (prefixo sem {account_id}).
"""
import hashlib
import hmac
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from src.api.deps import get_db
from src.db.models_whatsapp import WhatsAppAccount

logger = logging.getLogger("completepay.whatsapp.webhook")

webhook_router = APIRouter(
    prefix="/api/v1/public",
    tags=["whatsapp-webhook"],
)


def _parse_received_at(value: str | None) -> datetime | None:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Processamento assíncrono do evento (roda como BackgroundTask)
# ---------------------------------------------------------------------------

async def process_webhook_event(
    account_id: str,
    organization_id: str,
    raw_payload: dict[str, Any],
    provider: str,
) -> None:
    """
    Processa evento de webhook do provider.
    BackgroundTask abre sua própria sessão DB — não reutiliza a da request.
    """
    from src.db.session import SessionLocal
    from src.db.models_whatsapp import WhatsAppAccount
    from src.providers.whatsapp.factory import get_whatsapp_provider
    from src.providers.whatsapp.encryption import decrypt_api_key
    from src.services import whatsapp_service
    from src.ws.connection_manager import ws_manager
    from src.ws.registry import evolution_registry

    db = SessionLocal()
    try:
        account = db.query(WhatsAppAccount).filter(
            WhatsAppAccount.id == account_id,
            WhatsAppAccount.is_deleted.is_(False),
        ).first()
        if not account:
            logger.error("process_webhook_event: conta %s não encontrada.", account_id)
            return

        event = (raw_payload.get("event") or "").strip().lower()
        if event == "connection.update":
            data = raw_payload.get("data", {})
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
            return

        prov = get_whatsapp_provider(account)
        payloads = prov.parse_webhook(account_id, raw_payload)

        status_updates: list[dict[str, Any]] = []
        media_message_types = {"audio", "image", "video", "document", "sticker"}
        for payload in payloads:
            if payload.event_type == "message.received":
                for inbound in payload.inbound_messages:
                    event_at = _parse_received_at(inbound.received_at)
                    if (inbound.direction or "").lower() == "outbound":
                        msg = whatsapp_service.record_provider_outbound_message(
                            db=db,
                            organization_id=organization_id,
                            account=account,
                            external_message_id=inbound.external_message_id,
                            phone=inbound.phone_normalized,
                            message_type=inbound.message_type,
                            body_text=inbound.body_text,
                            media_url=inbound.media_url,
                            media_type=inbound.media_type,
                            media_filename=inbound.media_filename,
                            display_name=inbound.display_name,
                            profile_picture_url=inbound.profile_picture_url,
                            provider_metadata=inbound.provider_metadata,
                            event_at=event_at,
                        )
                    else:
                        msg = whatsapp_service.record_inbound_message(
                            db=db,
                            organization_id=organization_id,
                            account=account,
                            external_message_id=inbound.external_message_id,
                            phone=inbound.phone_normalized,
                            message_type=inbound.message_type,
                            body_text=inbound.body_text,
                            media_url=inbound.media_url,
                            media_type=inbound.media_type,
                            media_filename=inbound.media_filename,
                            display_name=inbound.display_name,
                            profile_picture_url=inbound.profile_picture_url,
                            provider_metadata=inbound.provider_metadata,
                            event_at=event_at,
                        )
                    db.commit()
                    if msg:
                        whatsapp_service.enrich_message_sender_context(msg)
                        media_url = msg.media_url
                        if (
                            isinstance(msg.provider_metadata, dict)
                            and (
                                msg.media_url
                                or msg.media_type
                                or str(msg.message_type or "").lower() in media_message_types
                            )
                        ):
                            media_url = f"/api/v1/whatsapp/messages/{msg.id}/media"
                        await ws_manager.broadcast(str(account_id), {
                            "type": "message.new",
                            "account_id": str(account_id),
                            "conversation_id": str(msg.conversation_id),
                            "conversation": whatsapp_service.serialize_conversation_snapshot(
                                db,
                                organization_id,
                                str(msg.conversation_id),
                            ),
                            "message": {
                                "id": str(msg.id),
                                "conversation_id": str(msg.conversation_id),
                                "external_message_id": msg.external_message_id,
                                "client_pending_id": msg.client_pending_id,
                                "direction": str(msg.direction),
                                "message_type": msg.message_type,
                                "body_text": msg.body_text,
                                "media_url": media_url,
                                "media_type": msg.media_type,
                                "media_filename": msg.media_filename,
                                "status": msg.status,
                                "created_at": msg.created_at.isoformat() if msg.created_at else None,
                                "is_group_message": bool(getattr(msg, "is_group_message", False)),
                                "sender_name": getattr(msg, "sender_name", None),
                                "sender_phone": getattr(msg, "sender_phone", None),
                            },
                        })

            elif payload.event_type in ("message.delivered", "message.read", "message.failed"):
                for su in payload.status_updates:
                    whatsapp_service.update_message_status(
                        db=db,
                        organization_id=organization_id,
                        external_message_id=su.external_message_id,
                        status=su.status,
                        error=su.error,
                    )
                    db.commit()
                    status_updates.append({
                        "external_message_id": su.external_message_id,
                        "status": su.status,
                        "error": su.error,
                    })

            else:
                logger.debug(
                    "process_webhook_event: evento '%s' ignorado.", payload.event_type
                )

        if status_updates:
            await ws_manager.broadcast(str(account_id), {
                "type": "message.update",
                "account_id": str(account_id),
                "data": status_updates,
            })

    except Exception:
        logger.exception(
            "process_webhook_event: erro ao processar webhook da conta %s.", account_id
        )
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Endpoint público de webhook
# ---------------------------------------------------------------------------

@webhook_router.post(
    "/whatsapp/webhook/{account_id}",
    status_code=200,
    summary="Webhook WhatsApp (público, autenticado por HMAC)",
    response_model=dict,
)
async def receive_whatsapp_webhook(
    account_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_webhook_secret: str | None = Header(None, alias="X-Webhook-Secret"),
    x_evolution_webhook_secret: str | None = Header(None, alias="X-Evolution-Webhook-Secret"),
    x_hub_signature: str | None = Header(None, alias="X-Hub-Signature-256"),
    x_evolution_signature: str | None = Header(None, alias="X-Evolution-Signature"),
):
    """
    Endpoint público de webhook WhatsApp.
    - Autenticação via HMAC-SHA256 (X-Hub-Signature-256 ou X-Evolution-Signature).
    - Resposta 200 imediata; processamento em BackgroundTask.
    - IMPORTANTE: prefixo /api/v1/public/whatsapp/webhook/ registrado em PUBLIC_ROUTES
      no middleware de auth (sem {account_id} literal).
    """
    # Buscar conta e verificar que existe
    account = db.query(WhatsAppAccount).filter(
        WhatsAppAccount.id == account_id,
        WhatsAppAccount.is_deleted.is_(False),
    ).first()

    if not account:
        # 200 para não revelar existência da conta a atacantes
        logger.warning("Webhook recebido para account_id inexistente: %s", account_id)
        return {"status": "ok"}

    raw_body = await request.body()

    # Validar segredo se webhook_secret_hash estiver configurado.
    # Preferência: header com segredo raw (hash no backend).
    # Compatibilidade: fallback para assinatura legada com chave=hash.
    if account.webhook_secret_hash:
        provided_secret = (x_webhook_secret or x_evolution_webhook_secret or "").strip()
        if provided_secret:
            provided_hash = hashlib.sha256(provided_secret.encode()).hexdigest()
            if not hmac.compare_digest(provided_hash, account.webhook_secret_hash):
                logger.warning("Webhook secret inválido para account_id=%s", account_id)
                raise HTTPException(status_code=400, detail="Assinatura de webhook inválida.")
        else:
            signature_header = (x_hub_signature or x_evolution_signature or "").strip()
            if not signature_header:
                logger.warning(
                    "Webhook inválido para account_id=%s: secret/signature ausente.",
                    account_id,
                )
                raise HTTPException(status_code=400, detail="Header de assinatura obrigatório.")

            sig_value = signature_header.removeprefix("sha256=")
            computed = hmac.new(
                account.webhook_secret_hash.encode(),
                raw_body,
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(computed, sig_value):
                logger.warning("Webhook HMAC inválido para account_id=%s", account_id)
                raise HTTPException(status_code=400, detail="Assinatura de webhook inválida.")

    # Parse do body JSON
    try:
        import json
        payload = json.loads(raw_body) if raw_body else {}
    except Exception:
        logger.warning("Webhook body inválido (não é JSON válido) para account_id=%s", account_id)
        return {"status": "ok"}  # aceitar e ignorar body malformado

    # Processamento em background — resposta imediata para o provider
    background_tasks.add_task(
        process_webhook_event,
        account_id=account_id,
        organization_id=account.organization_id,
        raw_payload=payload,
        provider=account.provider,
    )

    return {"status": "ok"}
