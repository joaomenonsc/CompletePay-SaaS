"""
Serviço de campanhas WhatsApp.
As BackgroundTasks abrem sua própria sessão DB (não reutilizam a da request).
Rate limiting usa asyncio.sleep() — NÃO time.sleep() — para não bloquear o event loop.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from src.db.models_whatsapp import (
    WhatsAppCampaign,
    WhatsAppCampaignRecipient,
    WhatsAppContact,
    WhatsAppTemplate,
    CampaignStatus,
    MessageStatus,
    TemplateStatus,
)

logger = logging.getLogger("completepay.whatsapp.campaign")


# ---------------------------------------------------------------------------
# Helpers de leitura
# ---------------------------------------------------------------------------

def get_campaign(
    db: Session,
    campaign_id: str,
    organization_id: str,
) -> Optional[WhatsAppCampaign]:
    return db.query(WhatsAppCampaign).filter(
        WhatsAppCampaign.id == campaign_id,
        WhatsAppCampaign.organization_id == organization_id,
        WhatsAppCampaign.is_deleted == False,
    ).first()


def list_campaigns(
    db: Session,
    organization_id: str,
    status: Optional[str] = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[WhatsAppCampaign], int]:
    q = db.query(WhatsAppCampaign).filter(
        WhatsAppCampaign.organization_id == organization_id,
        WhatsAppCampaign.is_deleted == False,
    )
    if status:
        q = q.filter(WhatsAppCampaign.status == status)
    total = q.count()
    items = q.order_by(WhatsAppCampaign.created_at.desc()).offset(offset).limit(limit).all()
    return items, total


def create_campaign(
    db: Session,
    organization_id: str,
    account_id: str,
    name: str,
    template_id: str,
    template_variables_default: Optional[dict] = None,
    segment_filter: Optional[dict] = None,
    scheduled_at: Optional[datetime] = None,
    messages_per_minute: int = 30,
    created_by: Optional[str] = None,
) -> WhatsAppCampaign:
    """Cria campanha em status DRAFT."""
    # Validar que o template existe e está APPROVED
    template = db.query(WhatsAppTemplate).filter(
        WhatsAppTemplate.id == template_id,
        WhatsAppTemplate.organization_id == organization_id,
        WhatsAppTemplate.is_deleted == False,
    ).first()
    if not template:
        raise ValueError(f"Template '{template_id}' não encontrado.")
    if template.status != TemplateStatus.APPROVED:
        raise ValueError(
            f"Template '{template.name}' não está aprovado (status: {template.status}). "
            "Apenas templates APPROVED podem ser usados em campanhas."
        )

    campaign = WhatsAppCampaign(
        organization_id=organization_id,
        account_id=account_id,
        name=name,
        template_id=template_id,
        template_variables_default=template_variables_default,
        segment_filter=segment_filter,
        scheduled_at=scheduled_at,
        messages_per_minute=messages_per_minute,
        created_by=created_by,
        status=CampaignStatus.DRAFT,
    )
    db.add(campaign)
    return campaign


def update_campaign(
    db: Session,
    campaign: WhatsAppCampaign,
    **kwargs,
) -> WhatsAppCampaign:
    if campaign.status not in (CampaignStatus.DRAFT, CampaignStatus.SCHEDULED):
        raise ValueError(
            f"Campanha em status '{campaign.status}' não pode ser editada. "
            "Apenas DRAFT ou SCHEDULED podem ser modificadas."
        )
    for k, v in kwargs.items():
        if v is not None and hasattr(campaign, k):
            setattr(campaign, k, v)
    return campaign


# ---------------------------------------------------------------------------
# Preview de destinatários (antes de iniciar a campanha)
# ---------------------------------------------------------------------------

def preview_recipients(
    db: Session,
    organization_id: str,
    segment_filter: Optional[dict] = None,
    sample_size: int = 10,
) -> dict[str, Any]:
    """
    Retorna preview dos contatos que seriam incluídos na campanha.
    Exclui opted-out automaticamente.
    """
    q = db.query(WhatsAppContact).filter(
        WhatsAppContact.organization_id == organization_id,
        WhatsAppContact.opted_out == False,
        WhatsAppContact.is_deleted == False,
    )

    # Aplicar filtros do segmento (simplificado — Fase 2 terá motor completo de tags)
    if segment_filter:
        tags = segment_filter.get("tags")
        if tags and isinstance(tags, list):
            q = q.filter(WhatsAppContact.tags.contains(tags))

    total = q.count()

    opted_out_count = db.query(WhatsAppContact).filter(
        WhatsAppContact.organization_id == organization_id,
        WhatsAppContact.opted_out == True,
    ).count()

    sample = q.limit(sample_size).all()
    sample_data = [
        {
            "contact_id": c.id,
            "phone": c.phone_display or c.phone_e164,
            "name": c.display_name,
        }
        for c in sample
    ]

    return {
        "total": total,
        "sample": sample_data,
        "opted_out_excluded": opted_out_count,
    }


# ---------------------------------------------------------------------------
# Construção da lista de destinatários
# ---------------------------------------------------------------------------

def build_recipient_list(
    db: Session,
    campaign: WhatsAppCampaign,
) -> int:
    """
    Constrói a lista de destinatários da campanha.
    Remove opted-out. Retorna total_recipients.
    Chama db.commit() internamente após construir a lista.
    """
    if campaign.status not in (CampaignStatus.DRAFT, CampaignStatus.SCHEDULED):
        raise ValueError(f"Campanha em status '{campaign.status}' não pode ser iniciada.")

    # Limpar lista anterior (caso seja re-start após pausa)
    db.query(WhatsAppCampaignRecipient).filter(
        WhatsAppCampaignRecipient.campaign_id == campaign.id,
        WhatsAppCampaignRecipient.status == MessageStatus.PENDING,
    ).delete(synchronize_session=False)

    # Buscar contatos elegíveis
    q = db.query(WhatsAppContact).filter(
        WhatsAppContact.organization_id == campaign.organization_id,
        WhatsAppContact.opted_out == False,
        WhatsAppContact.is_deleted == False,
    )
    seg = campaign.segment_filter or {}
    if seg.get("tags"):
        q = q.filter(WhatsAppContact.tags.contains(seg["tags"]))

    contacts = q.all()

    # Inserir recipients
    batch_size = 500
    for i in range(0, len(contacts), batch_size):
        batch = contacts[i:i + batch_size]
        db.bulk_insert_mappings(
            WhatsAppCampaignRecipient,
            [
                {
                    "organization_id": campaign.organization_id,
                    "campaign_id": campaign.id,
                    "contact_id": c.id,
                    "status": MessageStatus.PENDING,
                }
                for c in batch
            ],
        )
        db.flush()

    campaign.total_recipients = len(contacts)
    campaign.status = CampaignStatus.RUNNING
    campaign.started_at = datetime.now(timezone.utc)

    return len(contacts)


# ---------------------------------------------------------------------------
# Execução assíncrona da campanha (BackgroundTask)
# ---------------------------------------------------------------------------

async def execute_campaign(campaign_id: str, organization_id: str) -> None:
    """
    Execução assíncrona da campanha.
    IMPORTANTE:
    - Usa asyncio.sleep() (não time.sleep()) para não bloquear o event loop FastAPI.
    - Abre sessão própria (não reutiliza a da request, que já foi fechada).
    - Faz commits periódicos a cada 50 mensagens para não perder progresso.
    """
    from src.db.session import SessionLocal
    from src.db.models_whatsapp import WhatsAppAccount, WhatsAppCampaignRecipient
    from src.providers.whatsapp.factory import get_whatsapp_provider

    db = SessionLocal()
    try:
        campaign = db.query(WhatsAppCampaign).filter(
            WhatsAppCampaign.id == campaign_id,
            WhatsAppCampaign.organization_id == organization_id,
        ).first()

        if not campaign:
            logger.error("execute_campaign: campanha %s não encontrada.", campaign_id)
            return

        if campaign.status != CampaignStatus.RUNNING:
            logger.info("execute_campaign: campanha %s não está RUNNING (%s). Abortando.",
                        campaign_id, campaign.status)
            return

        account = db.query(WhatsAppAccount).filter(
            WhatsAppAccount.id == campaign.account_id,
        ).first()
        if not account:
            campaign.status = CampaignStatus.FAILED
            db.commit()
            return

        template = db.query(WhatsAppTemplate).filter(
            WhatsAppTemplate.id == campaign.template_id,
        ).first()
        if not template:
            campaign.status = CampaignStatus.FAILED
            db.commit()
            return

        try:
            provider = get_whatsapp_provider(account)
        except Exception as e:
            logger.error("execute_campaign: falha ao inicializar provider: %s", e)
            campaign.status = CampaignStatus.FAILED
            db.commit()
            return

        # Intervalo entre mensagens em segundos
        delay = 60.0 / max(1, campaign.messages_per_minute)

        # Processar recipients pendentes em lotes
        processed = 0
        while True:
            # Re-verificar status (pode ter sido pausado externamente)
            db.refresh(campaign)
            if campaign.status != CampaignStatus.RUNNING:
                logger.info(
                    "execute_campaign: campanha %s mudou para '%s'. Parando.",
                    campaign_id, campaign.status,
                )
                break

            # Buscar próximo lote de pendentes
            recipients = (
                db.query(WhatsAppCampaignRecipient)
                .filter(
                    WhatsAppCampaignRecipient.campaign_id == campaign_id,
                    WhatsAppCampaignRecipient.status == MessageStatus.PENDING,
                )
                .limit(50)
                .all()
            )

            if not recipients:
                # Fim da campanha
                campaign.status = CampaignStatus.COMPLETED
                campaign.completed_at = datetime.now(timezone.utc)
                db.commit()
                logger.info("execute_campaign: campanha %s concluída. Total: %d msg.",
                            campaign_id, processed)
                break

            for recipient in recipients:
                # Rate limiting — asyncio.sleep libera o event loop
                await asyncio.sleep(delay)

                contact = db.query(WhatsAppContact).filter(
                    WhatsAppContact.id == recipient.contact_id,
                ).first()

                if not contact or contact.opted_out:
                    recipient.status = "skipped"
                    continue

                vars_merged = {
                    **(campaign.template_variables_default or {}),
                    **(recipient.template_variables or {}),
                }
                try:
                    result = provider.send_template(
                        contact.phone_e164,
                        template.name,
                        template.language,
                        vars_merged,
                    )
                    now = datetime.now(timezone.utc)
                    if result.status != "failed" and result.external_message_id:
                        recipient.status = MessageStatus.SENT
                        recipient.sent_at = now
                        campaign.sent_count = (campaign.sent_count or 0) + 1
                    else:
                        recipient.status = MessageStatus.FAILED
                        recipient.failed_at = now
                        recipient.error_message = (result.error or "")[:512]
                        campaign.failed_count = (campaign.failed_count or 0) + 1

                except Exception as e:
                    logger.warning(
                        "execute_campaign: falha ao enviar para recipient %s: %s",
                        recipient.id, e,
                    )
                    recipient.status = MessageStatus.FAILED
                    recipient.failed_at = datetime.now(timezone.utc)
                    recipient.error_message = str(e)[:512]
                    campaign.failed_count = (campaign.failed_count or 0) + 1

                processed += 1

            # Commit periódico a cada lote (não perder progresso)
            db.commit()

    except Exception:
        logger.exception("execute_campaign: erro inesperado na campanha %s.", campaign_id)
        try:
            campaign = db.query(WhatsAppCampaign).filter(
                WhatsAppCampaign.id == campaign_id,
            ).first()
            if campaign:
                campaign.status = CampaignStatus.FAILED
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Pause / Resume
# ---------------------------------------------------------------------------

def pause_campaign(db: Session, campaign: WhatsAppCampaign) -> WhatsAppCampaign:
    if campaign.status != CampaignStatus.RUNNING:
        raise ValueError("Apenas campanhas em RUNNING podem ser pausadas.")
    campaign.status = CampaignStatus.PAUSED
    return campaign


def resume_campaign(db: Session, campaign: WhatsAppCampaign) -> WhatsAppCampaign:
    if campaign.status != CampaignStatus.PAUSED:
        raise ValueError("Apenas campanhas PAUSED podem ser retomadas.")
    campaign.status = CampaignStatus.RUNNING
    return campaign


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------

def get_campaign_progress(
    db: Session,
    campaign: WhatsAppCampaign,
) -> dict[str, Any]:
    """Retorna métricas de progresso da campanha."""
    total = campaign.total_recipients or 0
    sent = campaign.sent_count or 0
    delivered = campaign.delivered_count or 0
    read = campaign.read_count or 0
    failed = campaign.failed_count or 0
    pending = total - sent - failed

    completion = (sent + failed) / total * 100 if total > 0 else 0.0

    return {
        "campaign_id": campaign.id,
        "status": campaign.status,
        "total_recipients": total,
        "sent_count": sent,
        "delivered_count": delivered,
        "read_count": read,
        "failed_count": failed,
        "pending_count": max(0, pending),
        "completion_percent": round(completion, 1),
        "estimated_finish_at": None,  # Fase 2: calcular baseado no rate e pending
    }
