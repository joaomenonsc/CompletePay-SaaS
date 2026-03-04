"""
Rotas públicas do Email Marketing (sem autenticação JWT).

Endpoints:
    POST /api/v1/email-marketing/webhooks/resend  — Recebe webhooks do ESP Resend
    GET  /api/v1/email-marketing/unsubscribe       — Exibe página de confirmação de descadastro
    POST /api/v1/email-marketing/unsubscribe       — Processa o descadastro
"""
import html as html_escape_mod
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Form
from fastapi.responses import HTMLResponse
from sqlalchemy import select

from src.db.models_marketing import EmkCampaign, EmkSubscriber, EmkInboundEmail, EmkDomain
from src.db.session import SessionLocal
from src.services.unsubscribe_service import verify_unsubscribe_token

logger = logging.getLogger("completepay.emk_public")

router = APIRouter(prefix="/api/v1/email-marketing", tags=["email-marketing-public"])


# ── Webhook Resend ─────────────────────────────────────────────────────────────


RESEND_EVENT_MAP = {
    "email.delivered": "delivery",
    "email.opened": "open",
    "email.clicked": "click",
    "email.bounced": "bounce",
    "email.complained": "bounce",
    "email.delivery_delayed": None,  # Ignorar
}


@router.post("/webhooks/resend")
async def receive_resend_webhook(request: Request):
    """
    Recebe webhooks do Resend (via Svix).
    Valida assinatura e processa o evento.
    """
    body = await request.body()
    payload = await request.json()

    # SBP-002: verificar assinatura usando secret do SERVIDOR (nunca do header do cliente)
    from src.config.settings import get_settings
    _settings = get_settings()
    _webhook_secret = getattr(_settings, 'resend_webhook_secret', '') or ''
    svix_signature = request.headers.get("svix-signature", "")

    if _settings.app_env == "production" and not svix_signature:
        logger.warning("Webhook sem assinatura rejeitado em produção")
        raise HTTPException(status_code=401, detail="Webhook signature required")

    if svix_signature and _webhook_secret:
        try:
            from src.services.esp_adapter import get_esp_adapter
            adapter = get_esp_adapter()
            if not adapter.verify_webhook(body, svix_signature, _webhook_secret):
                logger.warning("Webhook signature verification failed")
                raise HTTPException(status_code=401, detail="Invalid webhook signature")
        except ImportError:
            if _settings.app_env == "production":
                raise HTTPException(status_code=500, detail="Webhook verification unavailable")

    # Extrair tipo de evento
    event_type_raw = payload.get("type", "")
    mapped_type = RESEND_EVENT_MAP.get(event_type_raw)

    if mapped_type is None:
        # Evento não mapeado — retornar 200 OK para evitar retry
        return {"status": "ignored", "event": event_type_raw}

    # Extrair message_id do payload Resend
    data = payload.get("data", {})
    esp_message_id = data.get("email_id") or data.get("message_id")
    if not esp_message_id:
        logger.warning(f"Webhook {event_type_raw} missing message_id")
        return {"status": "ignored", "reason": "no_message_id"}

    # Processar evento via service
    try:
        from src.services.marketing_service import process_webhook_event
        event_data = {
            "raw_type": event_type_raw,
            "timestamp": data.get("created_at"),
        }
        # Adicionar dados específicos do evento
        if mapped_type == "click":
            event_data["url"] = data.get("click", {}).get("link")
        if mapped_type == "bounce":
            event_data["bounce_type"] = data.get("bounce", {}).get("type")

        process_webhook_event(mapped_type, esp_message_id, event_data)
        logger.info(f"Processed webhook: {event_type_raw} for {esp_message_id}")
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        # Retornar 200 mesmo assim — o ESP fará retry se retornarmos 5xx
        return {"status": "error", "message": str(e)[:200]}

    return {"status": "ok", "event": mapped_type}


# ── Webhook Inbound (Recebimento de Emails) ────────────────────────────────────


@router.post("/webhooks/inbound")
async def receive_inbound_webhook(request: Request):
    """
    Recebe webhooks de Inbound do Resend (emails respondidos).
    Salva no banco e dispara automações (InboundEmailTrigger).
    """
    body = await request.body()
    payload = await request.json()

    # SBP-002: verificar assinatura usando secret do SERVIDOR
    from src.config.settings import get_settings
    _settings = get_settings()
    _webhook_secret = getattr(_settings, 'resend_webhook_secret', '') or ''
    svix_signature = request.headers.get("svix-signature", "")

    if _settings.app_env == "production" and not svix_signature:
        logger.warning("Inbound Webhook sem assinatura rejeitado em produção")
        raise HTTPException(status_code=401, detail="Webhook signature required")

    if svix_signature and _webhook_secret:
        try:
            from src.services.esp_adapter import get_esp_adapter
            adapter = get_esp_adapter()
            if not adapter.verify_webhook(body, svix_signature, _webhook_secret):
                logger.warning("Inbound Webhook signature verification failed")
                raise HTTPException(status_code=401, detail="Invalid webhook signature")
        except ImportError:
            if _settings.app_env == "production":
                raise HTTPException(status_code=500, detail="Webhook verification unavailable")

    # O Resend envia um formato específico para Inbound
    # ex: payload pode direto ser o objeto ou vir dentro de "data" dependendo da config
    data = payload.get("data", payload)

    from_addr = data.get("from", "")
    to_addr = data.get("to", [""])[0] if isinstance(data.get("to"), list) else data.get("to", "")
    subject = data.get("subject", "")
    text_content = data.get("text", "")
    html_content = data.get("html", "")

    if not to_addr or not from_addr:
        logger.warning("Inbound Webhook missing 'to' or 'from' addresses")
        return {"status": "ignored", "reason": "missing_addresses"}

    # Extrair domínio do destinatário (ex: atendimento@app.completepay.digital -> app.completepay.digital)
    to_domain = to_addr.split("@")[-1].lower() if "@" in to_addr else to_addr.lower()

    db = SessionLocal()
    try:
        # Encontrar a organização dona do domínio
        domain_record = db.execute(
            select(EmkDomain).where(EmkDomain.domain == to_domain)
        ).scalars().first()

        if not domain_record:
            logger.warning(f"Inbound Webhook received for unknown domain: {to_domain}")
            return {"status": "ignored", "reason": "unknown_domain"}

        org_id = domain_record.organization_id

        # Salvar o email no banco
        inbound_email = EmkInboundEmail(
            organization_id=org_id,
            from_email=from_addr,
            to_email=to_addr,
            subject=subject,
            text_content=text_content,
            html_content=html_content,
            status="unread"
        )
        db.add(inbound_email)
        db.commit()
        db.refresh(inbound_email)
        logger.info(f"Inbound email saved: {inbound_email.id} for org {org_id}")

        # Auditoria
        try:
            from src.services.audit_service import log_audit
            log_audit(
                db,
                organization_id=org_id,
                user_id="system_webhook",
                action="receive_inbound_email",
                resource_type="emk_inbound_email",
                resource_id=inbound_email.id,
                data_classification="CLI",
                data_after={
                    "from": from_addr,
                    "to": to_addr,
                    "subject": subject
                }
            )
        except Exception as audit_err:
            logger.warning(f"Failed to log inbound email audit: {audit_err}")

        # Disparar Automação
        try:
            from src.services.automation_service import trigger_execution_inbound_email
            # Formatar payload para a automação
            automation_payload = {
                "inbound_email_id": inbound_email.id,
                "from": from_addr,
                "to": to_addr,
                "subject": subject,
                "text": text_content,
                "html": html_content
            }
            triggered = trigger_execution_inbound_email(db, org_id, automation_payload)
            logger.info(f"Triggered {triggered} automations for inbound email {inbound_email.id}")
        except Exception as auto_err:
            logger.error(f"Failed to trigger automations: {auto_err}")

    except Exception as e:
        logger.error(f"Inbound Webhook processing error: {e}")
        return {"status": "error", "message": str(e)[:200]}
    finally:
        db.close()

    return {"status": "ok"}


# ── Unsubscribe ────────────────────────────────────────────────────────────────

_UNSUB_CONFIRM_HTML = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Descadastrar Email</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc; color: #334155;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; padding: 1rem;
        }
        .card {
            background: white; border-radius: 12px; padding: 2.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 480px; width: 100%;
            text-align: center;
        }
        h1 { font-size: 1.5rem; margin-bottom: 0.75rem; color: #0f172a; }
        p { font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; color: #64748b; }
        .btn {
            display: inline-block; background: #ef4444; color: white;
            border: none; border-radius: 8px; padding: 0.75rem 2rem;
            font-size: 1rem; cursor: pointer; text-decoration: none;
            transition: background 0.2s;
        }
        .btn:hover { background: #dc2626; }
        .subtle { font-size: 0.8rem; color: #94a3b8; margin-top: 1rem; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Descadastrar Email</h1>
        <p>Você será removido da nossa lista de email marketing.
        Você não receberá mais campanhas por email.</p>
        <form method="POST" action="/api/v1/email-marketing/unsubscribe">
            <input type="hidden" name="sid" value="{sid}">
            <input type="hidden" name="cid" value="{cid}">
            <input type="hidden" name="token" value="{token}">
            <button type="submit" class="btn">Confirmar descadastro</button>
        </form>
        <p class="subtle">Se você não solicitou este descadastro, pode ignorar esta página.</p>
    </div>
</body>
</html>"""


_UNSUB_SUCCESS_HTML = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Descadastrado</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc; color: #334155;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; padding: 1rem;
        }
        .card {
            background: white; border-radius: 12px; padding: 2.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 480px; width: 100%;
            text-align: center;
        }
        h1 { font-size: 1.5rem; margin-bottom: 0.75rem; color: #0f172a; }
        p { font-size: 0.95rem; line-height: 1.6; color: #64748b; }
        .check { font-size: 3rem; margin-bottom: 1rem; }
    </style>
</head>
<body>
    <div class="card">
        <div class="check">✅</div>
        <h1>Email descadastrado</h1>
        <p>Você foi removido com sucesso da nossa lista de email marketing.
        Você não receberá mais campanhas por email.</p>
    </div>
</body>
</html>"""


_UNSUB_ERROR_HTML = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Erro</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc; color: #334155;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; padding: 1rem;
        }
        .card {
            background: white; border-radius: 12px; padding: 2.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 480px; width: 100%;
            text-align: center;
        }
        h1 { font-size: 1.5rem; margin-bottom: 0.75rem; color: #ef4444; }
        p { font-size: 0.95rem; line-height: 1.6; color: #64748b; }
        .icon { font-size: 3rem; margin-bottom: 1rem; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">⚠️</div>
        <h1>Link inválido</h1>
        <p>Este link de descadastro é inválido ou já foi utilizado.
        Se você deseja se descadastrar, entre em contato conosco.</p>
    </div>
</body>
</html>"""


@router.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe_confirm_page(
    sid: str,
    cid: str,
    token: str,
):
    """Exibe página de confirmação de descadastro."""
    # Validar token
    if not verify_unsubscribe_token(sid, cid, token):
        return HTMLResponse(content=_UNSUB_ERROR_HTML, status_code=403)

    # SBP-013: escapar parâmetros para prevenir XSS
    safe_sid = html_escape_mod.escape(sid)
    safe_cid = html_escape_mod.escape(cid)
    safe_token = html_escape_mod.escape(token)
    html = _UNSUB_CONFIRM_HTML.replace("{sid}", safe_sid).replace("{cid}", safe_cid).replace("{token}", safe_token)
    return HTMLResponse(content=html)


@router.post("/unsubscribe", response_class=HTMLResponse)
async def process_unsubscribe(
    sid: str = Form(...),
    cid: str = Form(...),
    token: str = Form(...),
):
    """Processa o descadastro do subscriber."""
    # Validar token
    if not verify_unsubscribe_token(sid, cid, token):
        return HTMLResponse(content=_UNSUB_ERROR_HTML, status_code=403)

    db = SessionLocal()
    try:
        # Buscar subscriber
        subscriber = db.execute(
            select(EmkSubscriber).where(EmkSubscriber.id == sid)
        ).scalars().first()

        if not subscriber:
            return HTMLResponse(content=_UNSUB_ERROR_HTML, status_code=404)

        # Já descadastrado?
        if subscriber.status == "unsubscribed":
            return HTMLResponse(content=_UNSUB_SUCCESS_HTML)

        # Marcar como unsubscribed
        now = datetime.now(timezone.utc)
        subscriber.status = "unsubscribed"
        subscriber.unsubscribed_at = now

        # Atualizar contadores da campanha
        campaign = db.execute(
            select(EmkCampaign).where(EmkCampaign.id == cid)
        ).scalars().first()
        if campaign:
            campaign.total_unsubscribed = (campaign.total_unsubscribed or 0) + 1

        db.commit()
        logger.info(f"Subscriber {sid} unsubscribed via link (campaign {cid})")

        # LGPD Audit: registrar descadastro
        try:
            from src.services.audit_service import log_audit
            org_id = campaign.organization_id if campaign else "unknown"
            log_audit(
                db,
                organization_id=org_id,
                user_id="subscriber_self",
                action="lgpd_unsubscribe",
                resource_type="emk_subscriber",
                resource_id=sid,
                data_classification="CLI",
                data_after={
                    "campaign_id": cid,
                    "email": subscriber.email if hasattr(subscriber, "email") else None,
                    "channel": "unsubscribe_link",
                },
            )
        except Exception as audit_err:
            logger.warning(f"Failed to log unsubscribe audit: {audit_err}")

        return HTMLResponse(content=_UNSUB_SUCCESS_HTML)

    except Exception as e:
        logger.error(f"Unsubscribe error: {e}")
        return HTMLResponse(content=_UNSUB_ERROR_HTML, status_code=500)
    finally:
        db.close()
