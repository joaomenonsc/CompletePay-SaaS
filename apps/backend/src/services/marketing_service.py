"""
Servico de email marketing: envio de campanhas, render de templates, processamento de webhooks.
Usa o Resend como ESP (mesmo provider do email_service.py transacional).
"""
import logging
import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.models_crm import Patient, PatientConsent
from src.db.models_marketing import (
    EmkCampaign,
    EmkList,
    EmkListSubscriber,
    EmkSend,
    EmkSubscriber,
    EmkTemplate,
)
from src.db.session import SessionLocal

logger = logging.getLogger("completepay.marketing_service")


# ── Template rendering ──────────────────────────────────────────────────────


def render_template(html: str, variables: dict[str, str]) -> str:
    """
    Renderiza HTML template com variaveis via Jinja2.
    Wrapper de compatibilidade — para bulk send, use compile_template() + render_for_subscriber().
    """
    from src.services.template_engine import render_html
    return render_html(html, variables)


def render_subject(subject: str, variables: dict[str, str]) -> str:
    """Renderiza subject line com variaveis via Jinja2."""
    from src.services.template_engine import render_subject as _render_subject
    return _render_subject(subject, variables)


# ── Subscriber context ──────────────────────────────────────────────────────


def _build_subscriber_context(db: Session, subscriber: EmkSubscriber, org_id: str) -> dict[str, str]:
    """
    Constroi dicionario de variaveis para um subscriber.
    Se o subscriber estiver vinculado a um Patient, puxa dados do paciente.
    """
    context: dict[str, str] = {
        "email": subscriber.email,
        "nome_paciente": subscriber.name or subscriber.email.split("@")[0],
    }

    if subscriber.patient_id:
        patient = db.execute(
            select(Patient).where(
                Patient.id == subscriber.patient_id,
                Patient.organization_id == org_id,
            )
        ).scalars().first()
        if patient:
            context["nome_paciente"] = patient.social_name or patient.full_name
            context["nome_social"] = patient.social_name or ""
            context["telefone_paciente"] = patient.phone or ""

    return context


# ── Consent check ────────────────────────────────────────────────────────────


def _has_marketing_consent(db: Session, patient_id: str) -> bool:
    """Verifica se o paciente tem consentimento ativo para marketing (LGPD)."""
    consent = db.execute(
        select(PatientConsent).where(
            PatientConsent.patient_id == patient_id,
            PatientConsent.consent_type.in_(("marketing", "email_marketing")),
            PatientConsent.granted == True,
            PatientConsent.revoked_at.is_(None),
        )
    ).scalars().first()
    return consent is not None


# ── Campaign send (background task) ─────────────────────────────────────────


def process_campaign_send(campaign_id: str, organization_id: str) -> None:
    """
    Background task: processa envio de campanha.
    1. Buscar subscribers da lista com consentimento
    2. Renderizar template para cada subscriber
    3. Enviar via ESP adapter (com rate limiting integrado)
    4. Atualizar contadores
    """
    from src.services.esp_adapter import get_esp_adapter

    db = SessionLocal()
    try:
        campaign = db.execute(
            select(EmkCampaign).where(EmkCampaign.id == campaign_id)
        ).scalars().first()
        if not campaign:
            logger.error(f"Campaign {campaign_id} not found")
            return

        template = db.execute(
            select(EmkTemplate).where(EmkTemplate.id == campaign.template_id)
        ).scalars().first()
        if not template:
            campaign.status = "failed"
            db.commit()
            logger.error(f"Template {campaign.template_id} not found for campaign {campaign_id}")
            return

        # Buscar subscribers da lista
        subscribers = db.execute(
            select(EmkSubscriber)
            .join(EmkListSubscriber, EmkListSubscriber.subscriber_id == EmkSubscriber.id)
            .where(
                EmkListSubscriber.list_id == campaign.list_id,
                EmkSubscriber.status == "active",
            )
        ).scalars().all()

        if not subscribers:
            campaign.status = "sent"
            campaign.sent_at = datetime.now(timezone.utc)
            db.commit()
            logger.warning(f"No eligible subscribers for campaign {campaign_id}")
            return

        # Filtrar por consentimento LGPD
        eligible = []
        for sub in subscribers:
            if sub.patient_id:
                if _has_marketing_consent(db, sub.patient_id):
                    eligible.append(sub)
            else:
                eligible.append(sub)  # Subscriber sem patient_id: sem checagem LGPD

        campaign.total_recipients = len(eligible)

        # Criar registros de envio
        sends = []
        for sub in eligible:
            send = EmkSend(
                campaign_id=campaign.id,
                subscriber_id=sub.id,
                status="queued",
            )
            db.add(send)
            sends.append((send, sub))

        db.flush()

        # Obter ESP adapter (com rate limiting integrado)
        adapter = get_esp_adapter()

        # Obter configuracao de from_email
        from src.config.settings import get_settings
        settings = get_settings()
        from_domain = settings.resend_domain or "completepay.com.br"
        from_addr = campaign.from_email or f"marketing@{from_domain}"
        if campaign.from_name:
            from_addr = f"{campaign.from_name} <{from_addr}>"
        reply_to_addr = campaign.reply_to or None

        # Compile-once: compilar template Jinja2 uma unica vez
        from src.services.template_engine import compile_template as _compile, render_for_subscriber, render_subject as _render_subj
        compiled_html = _compile(template.html_content or "")
        compiled_subject = _compile(campaign.subject or "")

        sent_count = 0
        for send, sub in sends:
            try:
                context = _build_subscriber_context(db, sub, organization_id)
                # Injetar link de unsubscribe
                from src.services.unsubscribe_service import build_unsubscribe_url
                context["unsubscribe_url"] = build_unsubscribe_url(sub.id, campaign.id)

                html = render_for_subscriber(compiled_html, context)
                subject = render_for_subscriber(compiled_subject, context)

                # Enviar via ESP adapter (throttling automatico)
                send_kwargs: dict = {
                    "from_addr": from_addr,
                    "to": sub.email,
                    "subject": subject,
                    "html": html,
                }
                if reply_to_addr:
                    send_kwargs["reply_to"] = reply_to_addr
                result = adapter.send_single(**send_kwargs)
                if result.success:
                    send.esp_message_id = result.message_id
                    send.status = "sent"
                    send.sent_at = datetime.now(timezone.utc)
                    sent_count += 1
                else:
                    send.status = "failed"
                    send.error_message = (result.error or "")[:500]
                    logger.warning(f"ESP send failed for {sub.email}: {result.error}")
            except Exception as e:
                send.status = "failed"
                send.error_message = str(e)[:500]
                logger.error(f"Failed to send to {sub.email}: {e}")

        # Atualizar contadores da campanha
        campaign.total_sent = sent_count
        campaign.sent_at = datetime.now(timezone.utc)
        campaign.status = "sent" if sent_count == len(eligible) else "partial"
        db.commit()
        logger.info(f"Campaign {campaign_id}: sent {sent_count}/{len(eligible)} emails")

    except Exception as e:
        logger.error(f"Campaign {campaign_id} send failed: {e}")
        try:
            campaign = db.execute(
                select(EmkCampaign).where(EmkCampaign.id == campaign_id)
            ).scalars().first()
            if campaign:
                campaign.status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ── Webhook processing ──────────────────────────────────────────────────────


def process_webhook_event(event_type: str, esp_message_id: str, event_data: dict | None = None) -> None:
    """
    Processa evento de webhook do ESP (delivery, open, click, bounce, unsubscribe).
    Atualiza EmkSend e contadores da EmkCampaign.
    """
    db = SessionLocal()
    try:
        send = db.execute(
            select(EmkSend).where(EmkSend.esp_message_id == esp_message_id)
        ).scalars().first()
        if not send:
            logger.warning(f"Send not found for esp_message_id={esp_message_id}")
            return

        now = datetime.now(timezone.utc)
        campaign = db.execute(
            select(EmkCampaign).where(EmkCampaign.id == send.campaign_id)
        ).scalars().first()

        if event_type == "delivery" and not send.delivered_at:
            send.status = "delivered"
            send.delivered_at = now
            if campaign:
                campaign.total_delivered += 1

        elif event_type == "open" and not send.opened_at:
            send.status = "opened"
            send.opened_at = now
            if campaign:
                campaign.total_opened += 1

        elif event_type == "click" and not send.clicked_at:
            send.status = "clicked"
            send.clicked_at = now
            if campaign:
                campaign.total_clicked += 1

        elif event_type == "bounce" and not send.bounced_at:
            send.status = "bounced"
            send.bounced_at = now
            if campaign:
                campaign.total_bounced += 1
            # Marcar subscriber como bounced
            subscriber = db.execute(
                select(EmkSubscriber).where(EmkSubscriber.id == send.subscriber_id)
            ).scalars().first()
            if subscriber:
                subscriber.status = "bounced"

        elif event_type == "unsubscribe":
            if campaign:
                campaign.total_unsubscribed += 1
            subscriber = db.execute(
                select(EmkSubscriber).where(EmkSubscriber.id == send.subscriber_id)
            ).scalars().first()
            if subscriber:
                subscriber.status = "unsubscribed"
                subscriber.unsubscribed_at = now

        # Salvar evento
        from src.db.models_marketing import EmkEvent
        event = EmkEvent(
            send_id=send.id,
            event_type=event_type,
            event_data=event_data,
        )
        db.add(event)
        db.commit()

    except Exception as e:
        logger.error(f"Webhook processing failed: {e}")
    finally:
        db.close()
