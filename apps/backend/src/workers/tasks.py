"""
ARQ Tasks — funções assíncronas executadas pelo worker de background.

Tasks:
    - task_send_campaign: orquestra envio de campanha (cria sends, despacha chunks)
    - task_send_batch_chunk: processa um chunk de envios (render + ESP + retry)
    - task_check_scheduled_campaigns: cron que auto-despacha campanhas agendadas
"""
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select

from src.db.models_marketing import (
    EmkCampaign,
    EmkListSubscriber,
    EmkSend,
    EmkSubscriber,
    EmkTemplate,
)
from src.db.session import SessionLocal

logger = logging.getLogger("completepay.worker.tasks")

# Configuração de batch
DEFAULT_BATCH_SIZE = 50
MAX_RETRY_PER_EMAIL = 3
RETRY_BACKOFF_BASE = 2  # segundos


# ── Helpers ────────────────────────────────────────────────────────────────────


def _has_marketing_consent(db, patient_id: str) -> bool:
    """Verifica consentimento LGPD para marketing."""
    from src.services.marketing_service import _has_marketing_consent as _check
    return _check(db, patient_id)


def _build_subscriber_context(db, subscriber, org_id: str) -> dict:
    """Constroi contexto de variáveis para um subscriber."""
    from src.services.marketing_service import _build_subscriber_context as _build
    return _build(db, subscriber, org_id)


# ── task_send_campaign ─────────────────────────────────────────────────────────


async def task_send_campaign(ctx: dict, campaign_id: str, organization_id: str) -> dict:
    """
    Orquestra o envio de uma campanha:
    1. Carrega campanha e template
    2. Busca subscribers elegíveis (com consentimento LGPD)
    3. Cria registros EmkSend
    4. Divide em chunks e processa cada chunk sequencialmente
    5. Atualiza contadores da campanha após cada chunk
    """
    from src.config.settings import get_settings

    settings = get_settings()
    batch_size = settings.marketing_batch_size or DEFAULT_BATCH_SIZE

    db = SessionLocal()
    try:
        # 1. Carregar campanha
        campaign = db.execute(
            select(EmkCampaign).where(EmkCampaign.id == campaign_id)
        ).scalars().first()
        if not campaign:
            logger.error(f"Campaign {campaign_id} not found")
            return {"error": "campaign_not_found"}

        # Garantir que está em status válido para envio
        if campaign.status not in ("sending", "scheduled"):
            logger.warning(f"Campaign {campaign_id} in unexpected status: {campaign.status}")
            return {"error": f"invalid_status:{campaign.status}"}

        campaign.status = "sending"
        db.commit()

        # 2. Carregar template
        template = db.execute(
            select(EmkTemplate).where(EmkTemplate.id == campaign.template_id)
        ).scalars().first()
        if not template:
            campaign.status = "failed"
            db.commit()
            logger.error(f"Template {campaign.template_id} not found for campaign {campaign_id}")
            return {"error": "template_not_found"}

        # 3. Buscar subscribers da lista
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
            campaign.total_recipients = 0
            db.commit()
            logger.warning(f"No eligible subscribers for campaign {campaign_id}")
            return {"sent": 0, "total": 0}

        # 4. Filtrar por consentimento LGPD
        eligible = []
        filtered_ids = []  # Subscribers filtrados por falta de consentimento
        for sub in subscribers:
            if sub.patient_id:
                if _has_marketing_consent(db, sub.patient_id):
                    eligible.append(sub)
                else:
                    filtered_ids.append(sub.id)
            else:
                eligible.append(sub)

        # LGPD Audit: registrar filtragem por consentimento
        if filtered_ids:
            from src.services.audit_service import log_audit
            log_audit(
                db,
                organization_id=organization_id,
                user_id="system",
                action="lgpd_consent_filter",
                resource_type="emk_campaign",
                resource_id=campaign_id,
                data_classification="CLI",
                data_after={
                    "total_subscribers": len(subscribers),
                    "eligible": len(eligible),
                    "filtered_no_consent": len(filtered_ids),
                    "filtered_subscriber_ids": filtered_ids[:50],  # Limitar para não estourar
                },
            )
            logger.info(
                f"Campaign {campaign_id}: {len(filtered_ids)} subscribers filtered "
                f"(no LGPD consent), {len(eligible)} eligible"
            )

        campaign.total_recipients = len(eligible)
        db.commit()

        # 5. Criar registros de envio
        send_ids = []
        for sub in eligible:
            send = EmkSend(
                campaign_id=campaign.id,
                subscriber_id=sub.id,
                status="queued",
            )
            db.add(send)
            db.flush()
            send_ids.append(send.id)

        db.commit()
        logger.info(f"Campaign {campaign_id}: {len(send_ids)} sends created, processing in chunks of {batch_size}")

        # 6. Dividir em chunks e processar
        total_sent = 0
        total_failed = 0

        for i in range(0, len(send_ids), batch_size):
            chunk_ids = send_ids[i:i + batch_size]
            chunk_num = (i // batch_size) + 1
            total_chunks = (len(send_ids) + batch_size - 1) // batch_size

            logger.info(f"Campaign {campaign_id}: processing chunk {chunk_num}/{total_chunks} ({len(chunk_ids)} sends)")

            result = _process_batch_chunk(
                campaign_id=campaign_id,
                organization_id=organization_id,
                send_ids=chunk_ids,
                template_html=template.html_content or "",
                campaign_subject=campaign.subject or "",
                from_email=campaign.from_email,
                from_name=campaign.from_name,
                reply_to=campaign.reply_to,
            )

            total_sent += result["sent"]
            total_failed += result["failed"]

            # Atualizar contadores da campanha a cada chunk (progress tracking)
            campaign = db.execute(
                select(EmkCampaign).where(EmkCampaign.id == campaign_id)
            ).scalars().first()
            if campaign:
                campaign.total_sent = total_sent
                db.commit()

        # 7. Finalizar campanha
        campaign = db.execute(
            select(EmkCampaign).where(EmkCampaign.id == campaign_id)
        ).scalars().first()
        if campaign:
            campaign.total_sent = total_sent
            campaign.sent_at = datetime.now(timezone.utc)
            if total_sent == 0 and total_failed > 0:
                campaign.status = "failed"
            elif total_failed > 0:
                campaign.status = "partial"
            else:
                campaign.status = "sent"
            db.commit()

        logger.info(
            f"Campaign {campaign_id} complete: {total_sent} sent, {total_failed} failed "
            f"out of {len(send_ids)} total"
        )
        return {"sent": total_sent, "failed": total_failed, "total": len(send_ids)}

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
        raise  # Re-raise para ARQ fazer retry se configurado
    finally:
        db.close()


# ── _process_batch_chunk (sync helper) ─────────────────────────────────────────


def _process_batch_chunk(
    campaign_id: str,
    organization_id: str,
    send_ids: list[str],
    template_html: str,
    campaign_subject: str,
    from_email: str | None,
    from_name: str | None,
    reply_to: str | None,
) -> dict:
    """
    Processa um chunk de envios: render template + enviar via ESP.
    Implementa retry com backoff exponencial por email.
    Retorna {"sent": N, "failed": N}.
    """
    from src.config.settings import get_settings
    from src.services.esp_adapter import get_esp_adapter
    from src.services.template_engine import compile_template as _compile, render_for_subscriber

    settings = get_settings()
    from_domain = settings.resend_domain or "completepay.com.br"
    from_addr = from_email or f"marketing@{from_domain}"
    if from_name:
        from_addr = f"{from_name} <{from_addr}>"
    reply_to_addr = reply_to

    adapter = get_esp_adapter()
    compiled_html = _compile(template_html)
    compiled_subject = _compile(campaign_subject)

    db = SessionLocal()
    sent_count = 0
    failed_count = 0

    try:
        # Carregar sends com subscribers
        sends = db.execute(
            select(EmkSend, EmkSubscriber)
            .join(EmkSubscriber, EmkSubscriber.id == EmkSend.subscriber_id)
            .where(EmkSend.id.in_(send_ids))
        ).all()

        for send, subscriber in sends:
            success = False

            # Retry com backoff exponencial
            for attempt in range(1, MAX_RETRY_PER_EMAIL + 1):
                try:
                    context = _build_subscriber_context(db, subscriber, organization_id)
                    # Injetar link de unsubscribe
                    from src.services.unsubscribe_service import build_unsubscribe_url
                    context["unsubscribe_url"] = build_unsubscribe_url(subscriber.id, campaign_id)

                    html = render_for_subscriber(compiled_html, context)
                    subject = render_for_subscriber(compiled_subject, context)

                    send_kwargs: dict = {
                        "from_addr": from_addr,
                        "to": subscriber.email,
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
                        success = True
                        break
                    else:
                        send.error_message = (result.error or "")[:500]
                        if attempt < MAX_RETRY_PER_EMAIL:
                            backoff = RETRY_BACKOFF_BASE ** attempt
                            logger.warning(
                                f"ESP send failed for {subscriber.email} (attempt {attempt}/{MAX_RETRY_PER_EMAIL}), "
                                f"retrying in {backoff}s: {result.error}"
                            )
                            time.sleep(backoff)
                        else:
                            logger.error(
                                f"ESP send permanently failed for {subscriber.email} "
                                f"after {MAX_RETRY_PER_EMAIL} attempts: {result.error}"
                            )

                except Exception as e:
                    send.error_message = str(e)[:500]
                    if attempt < MAX_RETRY_PER_EMAIL:
                        backoff = RETRY_BACKOFF_BASE ** attempt
                        logger.warning(
                            f"Send error for {subscriber.email} (attempt {attempt}/{MAX_RETRY_PER_EMAIL}), "
                            f"retrying in {backoff}s: {e}"
                        )
                        time.sleep(backoff)
                    else:
                        logger.error(
                            f"Send permanently failed for {subscriber.email} "
                            f"after {MAX_RETRY_PER_EMAIL} attempts: {e}"
                        )

            if not success:
                send.status = "failed"
                send.retry_count = MAX_RETRY_PER_EMAIL
                failed_count += 1

        db.commit()

    except Exception as e:
        logger.error(f"Batch chunk processing error: {e}")
        raise
    finally:
        db.close()

    return {"sent": sent_count, "failed": failed_count}


# ── task_send_batch_chunk (ARQ task wrapper) ───────────────────────────────────


async def task_send_batch_chunk(
    ctx: dict,
    campaign_id: str,
    organization_id: str,
    send_ids: list[str],
    template_html: str,
    campaign_subject: str,
    from_email: str | None = None,
    from_name: str | None = None,
    reply_to: str | None = None,
) -> dict:
    """ARQ task wrapper para processar um chunk de envios."""
    return _process_batch_chunk(
        campaign_id=campaign_id,
        organization_id=organization_id,
        send_ids=send_ids,
        template_html=template_html,
        campaign_subject=campaign_subject,
        from_email=from_email,
        from_name=from_name,
        reply_to=reply_to,
    )


# ── task_check_scheduled_campaigns ─────────────────────────────────────────────


async def task_check_scheduled_campaigns(ctx: dict) -> dict:
    """
    Cron job: verifica campanhas com status='scheduled' e scheduled_at <= now().
    Enfileira task_send_campaign para cada campanha encontrada.
    """
    db = SessionLocal()
    dispatched = 0
    try:
        now = datetime.now(timezone.utc)
        campaigns = db.execute(
            select(EmkCampaign).where(
                EmkCampaign.status == "scheduled",
                EmkCampaign.scheduled_at <= now,
            )
        ).scalars().all()

        if not campaigns:
            return {"dispatched": 0}

        for campaign in campaigns:
            # Marcar como sending para evitar double-dispatch
            campaign.status = "sending"
            db.commit()

            # Enfileirar no ARQ
            try:
                redis = ctx.get("redis")
                if redis:
                    from arq.connections import ArqRedis
                    if isinstance(redis, ArqRedis):
                        await redis.enqueue_job(
                            "task_send_campaign",
                            campaign.id,
                            campaign.organization_id,
                        )
                        dispatched += 1
                        logger.info(
                            f"Scheduled campaign {campaign.id} dispatched for sending"
                        )
                else:
                    # Fallback: processar diretamente
                    await task_send_campaign(ctx, campaign.id, campaign.organization_id)
                    dispatched += 1

            except Exception as e:
                logger.error(f"Failed to dispatch campaign {campaign.id}: {e}")
                campaign.status = "scheduled"  # Reverter status
                db.commit()

        logger.info(f"Scheduled campaigns check: {dispatched} dispatched out of {len(campaigns)}")
        return {"dispatched": dispatched, "total_checked": len(campaigns)}

    except Exception as e:
        logger.error(f"Scheduled campaigns check failed: {e}")
        return {"error": str(e)}
    finally:
        db.close()
