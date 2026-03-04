"""
Rotas do modulo Email Marketing.
Requer JWT + X-Organization-Id + RBAC (roles: mkt, gcl).
"""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.api.deps import require_organization_id, require_org_role
from src.api.middleware.auth import require_user_id
from src.cache import cache_get_sync, cache_set_sync, cache_invalidate_prefix_sync, make_cache_key
from src.db.models_marketing import (
    EmkCampaign,
    EmkDomain,
    EmkList,
    EmkListSubscriber,
    EmkSend,
    EmkSubscriber,
    EmkTemplate,
)
from src.db.session import get_db
from src.schemas.marketing import (
    CampaignCreate,
    CampaignListResponse,
    CampaignMetricsResponse,
    CampaignResponse,
    CampaignScheduleRequest,
    CampaignUpdate,
    CsvImportResponse,
    DomainCreate,
    DomainListResponse,
    DomainResponse,
    DomainUpdate,
    ListCreate,
    ListListResponse,
    ListResponse,
    ListUpdate,
    OverviewMetricsResponse,
    PatientSyncResponse,
    SubscriberCreate,
    SubscriberResponse,
    TemplateCreate,
    TemplateListResponse,
    TemplatePreviewRequest,
    TemplatePreviewResponse,
    TemplateResponse,
    TemplateUpdate,
    SingleEmailRequest,
)
from src.services.audit_service import log_audit

logger = logging.getLogger("completepay.marketing")

router = APIRouter(prefix="/api/v1/email-marketing", tags=["email-marketing"])

ROLES_READ = ["mkt", "gcl"]
ROLES_WRITE = ["mkt", "gcl"]


# ── Helpers ──────────────────────────────────────────────────────────────────


def _get_template_or_404(db: Session, template_id: str, organization_id: str) -> EmkTemplate:
    row = db.execute(
        select(EmkTemplate).where(
            EmkTemplate.id == template_id,
            EmkTemplate.organization_id == organization_id,
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Template nao encontrado.")
    return row


def _get_campaign_or_404(db: Session, campaign_id: str, organization_id: str) -> EmkCampaign:
    row = db.execute(
        select(EmkCampaign).where(
            EmkCampaign.id == campaign_id,
            EmkCampaign.organization_id == organization_id,
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Campanha nao encontrada.")
    return row


def _get_list_or_404(db: Session, list_id: str, organization_id: str) -> EmkList:
    row = db.execute(
        select(EmkList).where(
            EmkList.id == list_id,
            EmkList.organization_id == organization_id,
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Lista nao encontrada.")
    return row


def _get_domain_or_404(db: Session, domain_id: str, organization_id: str) -> EmkDomain:
    row = db.execute(
        select(EmkDomain).where(
            EmkDomain.id == domain_id,
            EmkDomain.organization_id == organization_id,
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Dominio nao encontrado.")
    return row


def _validate_from_email_domain(db: Session, from_email: str, organization_id: str) -> None:
    """Valida que o domínio do from_email está verificado para a organização."""
    if "@" not in from_email:
        raise HTTPException(status_code=422, detail="from_email deve ser um endereço de email válido.")
    domain_part = from_email.split("@")[1].lower()
    verified = db.execute(
        select(EmkDomain).where(
            EmkDomain.organization_id == organization_id,
            EmkDomain.domain == domain_part,
            EmkDomain.status == "verified",
        )
    ).scalars().first()
    if not verified:
        raise HTTPException(
            status_code=422,
            detail=f"O domínio '{domain_part}' não está verificado. Verifique o domínio antes de usá-lo como remetente.",
        )


# ═══════════════════════════════════════════════════════════════════════════════
#  TEMPLATES
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/templates", response_model=TemplateListResponse)
def list_templates(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, description="Busca por nome do template"),
    category: str | None = Query(None, description="Filtrar por categoria"),
):
    """Lista templates da organizacao (paginado)."""
    cache_key = make_cache_key("emk:templates", organization_id, q=q or "", category=category or "", limit=limit, offset=offset)
    if cached := cache_get_sync(cache_key):
        return cached
    base = select(EmkTemplate).where(EmkTemplate.organization_id == organization_id)
    if q and q.strip():
        base = base.where(EmkTemplate.name.ilike(f"%{q.strip()}%"))
    if category and category.strip():
        base = base.where(EmkTemplate.category == category.strip())
    total = db.execute(select(func.count()).select_from(base.subquery())).scalar() or 0
    rows = db.execute(base.order_by(EmkTemplate.updated_at.desc()).limit(limit).offset(offset)).scalars().all()
    result = TemplateListResponse(
        items=[TemplateResponse.model_validate(t) for t in rows],
        total=total, limit=limit, offset=offset,
    )
    cache_set_sync(cache_key, result.model_dump(mode="json"), ttl=120)
    return result


@router.post("/templates", response_model=TemplateResponse, status_code=201)
def create_template(
    body: TemplateCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria template de email."""
    from src.services.template_engine import sanitize_html, validate_template

    # Validar e sanitizar HTML
    if body.html_content:
        errors = validate_template(body.html_content)
        if errors:
            logger.warning("Template validation warnings: %s", errors)
        html_content = sanitize_html(body.html_content)
    else:
        html_content = body.html_content

    template = EmkTemplate(
        organization_id=organization_id,
        name=body.name,
        category=body.category,
        subject_template=body.subject_template,
        html_content=html_content,
        blocks_json=body.blocks_json,
        variables=body.variables,
        created_by=user_id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    cache_invalidate_prefix_sync(f"emk:templates:{organization_id}")
    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="create", resource_type="emk_template", resource_id=template.id,
        data_classification="ADM",
        data_after=TemplateResponse.model_validate(template).model_dump(mode="json"),
    )
    return TemplateResponse.model_validate(template)


@router.get("/templates/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna template por ID."""
    return TemplateResponse.model_validate(
        _get_template_or_404(db, template_id, organization_id)
    )


@router.put("/templates/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: str,
    body: TemplateUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza template."""
    from src.services.template_engine import sanitize_html, validate_template

    template = _get_template_or_404(db, template_id, organization_id)
    updates = body.model_dump(exclude_unset=True)

    # Sanitizar HTML se presente
    if "html_content" in updates and updates["html_content"]:
        errors = validate_template(updates["html_content"])
        if errors:
            logger.warning("Template validation warnings: %s", errors)
        updates["html_content"] = sanitize_html(updates["html_content"])

    for k, v in updates.items():
        setattr(template, k, v)
    db.commit()
    db.refresh(template)
    cache_invalidate_prefix_sync(f"emk:templates:{organization_id}")
    return TemplateResponse.model_validate(template)


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Remove template."""
    template = _get_template_or_404(db, template_id, organization_id)
    db.delete(template)
    db.commit()
    cache_invalidate_prefix_sync(f"emk:templates:{organization_id}")
    return None


@router.post("/templates/{template_id}/preview", response_model=TemplatePreviewResponse)
def preview_template(
    template_id: str,
    body: TemplatePreviewRequest,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Renderiza preview do template com variaveis de amostra."""
    from src.services.template_engine import extract_variables, render_html, render_subject

    template = _get_template_or_404(db, template_id, organization_id)

    variables_used = extract_variables(template.html_content or "")

    # Merge: variaveis do body prevalecem; preencher faltantes com placeholder
    merged = {var: f"[{var}]" for var in variables_used}
    merged.update(body.variables)

    rendered_html = render_html(template.html_content or "", merged)
    rendered_subject = render_subject(template.subject_template or "", merged)

    return TemplatePreviewResponse(
        subject=rendered_subject,
        html=rendered_html,
        variables_used=variables_used,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  CAMPANHAS
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/campaigns", response_model=CampaignListResponse)
def list_campaigns(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None, description="Filtrar por status"),
    q: str | None = Query(None, description="Busca por nome"),
):
    """Lista campanhas (paginado, filtro por status)."""
    base = select(EmkCampaign).where(EmkCampaign.organization_id == organization_id)
    if q and q.strip():
        base = base.where(EmkCampaign.name.ilike(f"%{q.strip()}%"))
    if status and status.strip():
        base = base.where(EmkCampaign.status == status.strip())
    total = db.execute(select(func.count()).select_from(base.subquery())).scalar() or 0
    rows = db.execute(base.order_by(EmkCampaign.created_at.desc()).limit(limit).offset(offset)).scalars().all()
    return CampaignListResponse(
        items=[CampaignResponse.model_validate(c) for c in rows],
        total=total, limit=limit, offset=offset,
    )


@router.post("/campaigns", response_model=CampaignResponse, status_code=201)
def create_campaign(
    body: CampaignCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria campanha."""
    # Validar template e lista se informados
    if body.template_id:
        _get_template_or_404(db, body.template_id, organization_id)
    if body.list_id:
        _get_list_or_404(db, body.list_id, organization_id)
    # Validar domínio do from_email
    if body.from_email:
        _validate_from_email_domain(db, body.from_email, organization_id)
    campaign = EmkCampaign(
        organization_id=organization_id,
        name=body.name,
        subject=body.subject,
        template_id=body.template_id,
        list_id=body.list_id,
        from_email=body.from_email,
        from_name=body.from_name,
        reply_to=body.reply_to,
        scheduled_at=body.scheduled_at,
        status="scheduled" if body.scheduled_at else "draft",
        created_by=user_id,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    cache_invalidate_prefix_sync(f"emk:analytics:{organization_id}")
    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="create", resource_type="emk_campaign", resource_id=campaign.id,
        data_classification="ADM",
        data_after=CampaignResponse.model_validate(campaign).model_dump(mode="json"),
    )
    return CampaignResponse.model_validate(campaign)


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
def get_campaign(
    campaign_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna campanha por ID."""
    return CampaignResponse.model_validate(
        _get_campaign_or_404(db, campaign_id, organization_id)
    )


@router.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
def update_campaign(
    campaign_id: str,
    body: CampaignUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza campanha (apenas draft/scheduled)."""
    campaign = _get_campaign_or_404(db, campaign_id, organization_id)
    if campaign.status not in ("draft", "scheduled"):
        raise HTTPException(status_code=400, detail="Apenas campanhas em rascunho ou agendadas podem ser editadas.")
    updates = body.model_dump(exclude_unset=True)
    # Re-validar referências se alteradas
    if "template_id" in updates and updates["template_id"]:
        _get_template_or_404(db, updates["template_id"], organization_id)
    if "list_id" in updates and updates["list_id"]:
        _get_list_or_404(db, updates["list_id"], organization_id)
    if "from_email" in updates and updates["from_email"]:
        _validate_from_email_domain(db, updates["from_email"], organization_id)
    # Atualizar status baseado em scheduled_at
    if "scheduled_at" in updates:
        if updates["scheduled_at"]:
            updates["status"] = "scheduled"
        else:
            updates["status"] = "draft"
    for k, v in updates.items():
        setattr(campaign, k, v)
    db.commit()
    db.refresh(campaign)
    cache_invalidate_prefix_sync(f"emk:analytics:{organization_id}")
    return CampaignResponse.model_validate(campaign)


@router.post("/campaigns/{campaign_id}/send", response_model=CampaignResponse)
def send_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Dispara envio da campanha via ARQ worker (com fallback para BackgroundTasks)."""
    campaign = _get_campaign_or_404(db, campaign_id, organization_id)
    if campaign.status not in ("draft", "scheduled"):
        raise HTTPException(status_code=400, detail="Campanha nao pode ser enviada neste status.")
    if not campaign.template_id:
        raise HTTPException(status_code=400, detail="Campanha precisa de um template associado.")
    if not campaign.list_id:
        raise HTTPException(status_code=400, detail="Campanha precisa de uma lista de destinatarios.")
    # Validar domínio do from_email antes de enviar
    if campaign.from_email:
        _validate_from_email_domain(db, campaign.from_email, organization_id)

    campaign.status = "sending"
    db.commit()
    db.refresh(campaign)

    # Tentar enfileirar via ARQ (Redis)
    enqueued_via_arq = False
    try:
        import asyncio
        from arq.connections import create_pool
        from src.workers.settings import _get_redis_settings

        async def _enqueue():
            pool = await create_pool(_get_redis_settings())
            await pool.enqueue_job(
                "task_send_campaign",
                campaign.id,
                organization_id,
            )
            await pool.close()

        loop = asyncio.new_event_loop()
        loop.run_until_complete(_enqueue())
        loop.close()
        enqueued_via_arq = True
    except Exception as arq_err:
        import logging
        logging.getLogger("completepay.marketing").warning(
            f"ARQ enqueue failed, falling back to BackgroundTasks: {arq_err}"
        )

    # Fallback: usar BackgroundTasks do FastAPI se ARQ não está disponível
    if not enqueued_via_arq:
        from src.services.marketing_service import process_campaign_send
        background_tasks.add_task(process_campaign_send, campaign.id, organization_id)

    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="send", resource_type="emk_campaign", resource_id=campaign.id,
        data_classification="ADM",
    )
    return CampaignResponse.model_validate(campaign)


@router.post("/campaigns/{campaign_id}/cancel", response_model=CampaignResponse)
def cancel_campaign(
    campaign_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Cancela campanha."""
    campaign = _get_campaign_or_404(db, campaign_id, organization_id)
    if campaign.status in ("sent", "cancelled"):
        raise HTTPException(status_code=400, detail="Campanha ja finalizada ou cancelada.")
    campaign.status = "cancelled"
    db.commit()
    db.refresh(campaign)
    return CampaignResponse.model_validate(campaign)


@router.post("/campaigns/{campaign_id}/schedule", response_model=CampaignResponse)
def schedule_campaign(
    campaign_id: str,
    body: CampaignScheduleRequest,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Agenda campanha para envio em data/hora específica."""
    campaign = _get_campaign_or_404(db, campaign_id, organization_id)
    if campaign.status not in ("draft", "scheduled"):
        raise HTTPException(status_code=400, detail="Apenas campanhas em rascunho ou agendadas podem ser agendadas.")
    campaign.scheduled_at = body.scheduled_at
    campaign.status = "scheduled"
    db.commit()
    db.refresh(campaign)
    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="schedule", resource_type="emk_campaign", resource_id=campaign.id,
        data_classification="ADM",
    )
    return CampaignResponse.model_validate(campaign)


@router.delete("/campaigns/{campaign_id}", status_code=204)
def delete_campaign(
    campaign_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Remove campanha (apenas draft/scheduled)."""
    campaign = _get_campaign_or_404(db, campaign_id, organization_id)
    if campaign.status not in ("draft", "scheduled"):
        raise HTTPException(status_code=400, detail="Apenas campanhas em rascunho ou agendadas podem ser removidas.")
    db.delete(campaign)
    db.commit()
    cache_invalidate_prefix_sync(f"emk:analytics:{organization_id}")
    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="delete", resource_type="emk_campaign", resource_id=campaign_id,
        data_classification="ADM",
    )
    return None


@router.post("/campaigns/{campaign_id}/duplicate", response_model=CampaignResponse, status_code=201)
def duplicate_campaign(
    campaign_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Duplica campanha como novo rascunho."""
    original = _get_campaign_or_404(db, campaign_id, organization_id)
    new_campaign = EmkCampaign(
        organization_id=organization_id,
        name=f"{original.name} (cópia)",
        subject=original.subject,
        template_id=original.template_id,
        list_id=original.list_id,
        from_email=original.from_email,
        from_name=original.from_name,
        reply_to=original.reply_to,
        status="draft",
        created_by=user_id,
    )
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)
    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="duplicate", resource_type="emk_campaign", resource_id=new_campaign.id,
        data_classification="ADM",
        data_after=CampaignResponse.model_validate(new_campaign).model_dump(mode="json"),
    )
    return CampaignResponse.model_validate(new_campaign)


@router.get("/campaigns/{campaign_id}/analytics", response_model=CampaignMetricsResponse)
def get_campaign_analytics(
    campaign_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna metricas detalhadas da campanha."""
    campaign = _get_campaign_or_404(db, campaign_id, organization_id)
    sent = campaign.total_sent or 1  # avoid division by zero
    delivered = campaign.total_delivered or 1
    return CampaignMetricsResponse(
        campaign_id=campaign.id,
        total_recipients=campaign.total_recipients,
        total_sent=campaign.total_sent,
        total_delivered=campaign.total_delivered,
        total_opened=campaign.total_opened,
        total_clicked=campaign.total_clicked,
        total_bounced=campaign.total_bounced,
        total_unsubscribed=campaign.total_unsubscribed,
        delivery_rate=round(campaign.total_delivered / sent * 100, 2) if campaign.total_sent else 0,
        open_rate=round(campaign.total_opened / delivered * 100, 2) if campaign.total_delivered else 0,
        click_rate=round(campaign.total_clicked / delivered * 100, 2) if campaign.total_delivered else 0,
        bounce_rate=round(campaign.total_bounced / sent * 100, 2) if campaign.total_sent else 0,
        unsubscribe_rate=round(campaign.total_unsubscribed / delivered * 100, 2) if campaign.total_delivered else 0,
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  LISTAS
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/lists", response_model=ListListResponse)
def list_lists(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, description="Busca por nome"),
):
    """Lista listas de destinatarios."""
    cache_key = make_cache_key("emk:lists", organization_id, q=q or "", limit=limit, offset=offset)
    if cached := cache_get_sync(cache_key):
        return cached
    base = select(EmkList).where(EmkList.organization_id == organization_id)
    if q and q.strip():
        base = base.where(EmkList.name.ilike(f"%{q.strip()}%"))
    total = db.execute(select(func.count()).select_from(base.subquery())).scalar() or 0
    rows = db.execute(base.order_by(EmkList.updated_at.desc()).limit(limit).offset(offset)).scalars().all()
    result = ListListResponse(
        items=[ListResponse.model_validate(l) for l in rows],
        total=total, limit=limit, offset=offset,
    )
    cache_set_sync(cache_key, result.model_dump(mode="json"), ttl=120)
    return result


@router.post("/lists", response_model=ListResponse, status_code=201)
def create_list(
    body: ListCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria lista de destinatarios."""
    lst = EmkList(
        organization_id=organization_id,
        name=body.name,
        description=body.description,
        list_type=body.list_type,
        filter_criteria=body.filter_criteria,
        created_by=user_id,
    )
    db.add(lst)
    db.commit()
    db.refresh(lst)
    cache_invalidate_prefix_sync(f"emk:lists:{organization_id}")
    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="create", resource_type="emk_list", resource_id=lst.id,
        data_classification="ADM",
    )
    return ListResponse.model_validate(lst)


@router.get("/lists/{list_id}", response_model=ListResponse)
def get_list(
    list_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna lista por ID."""
    return ListResponse.model_validate(
        _get_list_or_404(db, list_id, organization_id)
    )


@router.put("/lists/{list_id}", response_model=ListResponse)
def update_list(
    list_id: str,
    body: ListUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza lista."""
    lst = _get_list_or_404(db, list_id, organization_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(lst, k, v)
    db.commit()
    db.refresh(lst)
    return ListResponse.model_validate(lst)


@router.delete("/lists/{list_id}", status_code=204)
def delete_list(
    list_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Remove lista."""
    lst = _get_list_or_404(db, list_id, organization_id)
    db.delete(lst)
    db.commit()
    return None


@router.get("/lists/{list_id}/subscribers", response_model=list[SubscriberResponse])
def list_subscribers(
    list_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Lista subscribers de uma lista."""
    _get_list_or_404(db, list_id, organization_id)
    rows = db.execute(
        select(EmkSubscriber)
        .join(EmkListSubscriber, EmkListSubscriber.subscriber_id == EmkSubscriber.id)
        .where(EmkListSubscriber.list_id == list_id)
        .order_by(EmkSubscriber.email)
        .limit(limit)
        .offset(offset)
    ).scalars().all()
    return [SubscriberResponse.model_validate(s) for s in rows]


@router.post("/lists/{list_id}/subscribers", response_model=SubscriberResponse, status_code=201)
def add_subscriber_to_list(
    list_id: str,
    body: SubscriberCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Adiciona subscriber a uma lista. Cria subscriber se nao existir."""
    lst = _get_list_or_404(db, list_id, organization_id)

    # Buscar ou criar subscriber
    subscriber = db.execute(
        select(EmkSubscriber).where(
            EmkSubscriber.organization_id == organization_id,
            EmkSubscriber.email == body.email.lower().strip(),
        )
    ).scalars().first()

    if not subscriber:
        subscriber = EmkSubscriber(
            organization_id=organization_id,
            email=body.email.lower().strip(),
            name=body.name,
            patient_id=body.patient_id,
        )
        db.add(subscriber)
        db.flush()

    # Vincular se nao estiver na lista
    existing = db.execute(
        select(EmkListSubscriber).where(
            EmkListSubscriber.list_id == list_id,
            EmkListSubscriber.subscriber_id == subscriber.id,
        )
    ).scalars().first()

    if not existing:
        link = EmkListSubscriber(list_id=list_id, subscriber_id=subscriber.id)
        db.add(link)
        lst.subscriber_count = (lst.subscriber_count or 0) + 1

    db.commit()
    db.refresh(subscriber)
    return SubscriberResponse.model_validate(subscriber)


@router.post("/lists/{list_id}/import", response_model=CsvImportResponse)
async def import_csv_to_list(
    list_id: str,
    file: UploadFile = File(..., description="Arquivo CSV com colunas email e name"),
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Importa subscribers de um arquivo CSV para a lista."""
    from src.services.subscriber_service import import_csv_to_list as _import_csv

    _get_list_or_404(db, list_id, organization_id)

    # Validar tipo de arquivo
    if file.content_type and file.content_type not in ("text/csv", "application/octet-stream", "text/plain"):
        raise HTTPException(status_code=400, detail="Arquivo deve ser CSV.")

    content = await file.read()
    try:
        csv_text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            csv_text = content.decode("latin-1")
        except Exception:
            raise HTTPException(status_code=400, detail="Encoding do arquivo não suportado. Use UTF-8.")

    result = _import_csv(db, list_id, organization_id, csv_text)

    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="import_csv", resource_type="emk_list", resource_id=list_id,
        data_classification="ADM",
        data_after={"total_rows": result.total_rows, "created": result.created, "skipped": result.skipped},
    )
    return CsvImportResponse(
        total_rows=result.total_rows,
        created=result.created,
        skipped=result.skipped,
        errors=result.errors,
    )


@router.post("/subscribers/sync-patients", response_model=PatientSyncResponse)
def sync_patients(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Sincroniza pacientes com email e consent ativo para subscribers."""
    from src.services.subscriber_service import sync_patients_to_subscribers

    result = sync_patients_to_subscribers(db, organization_id)

    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="sync_patients", resource_type="emk_subscribers", resource_id="bulk",
        data_classification="ADM",
        data_after={"synced": result.synced, "unsubscribed": result.unsubscribed, "skipped": result.skipped},
    )
    return PatientSyncResponse(
        synced=result.synced,
        unsubscribed=result.unsubscribed,
        skipped=result.skipped,
    )


@router.get("/subscribers/{subscriber_id}/consent-status")
def get_subscriber_consent_status(
    subscriber_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna o status de consentimento LGPD para marketing de um subscriber."""
    from src.db.models_crm import PatientConsent

    subscriber = db.execute(
        select(EmkSubscriber).where(EmkSubscriber.id == subscriber_id)
    ).scalars().first()
    if not subscriber:
        raise HTTPException(status_code=404, detail="Subscriber não encontrado.")

    result = {
        "subscriber_id": subscriber.id,
        "email": subscriber.email,
        "status": subscriber.status,
        "has_patient": subscriber.patient_id is not None,
        "patient_id": subscriber.patient_id,
        "consent_required": subscriber.patient_id is not None,
        "consent_granted": False,
        "consent_details": None,
    }

    if subscriber.patient_id:
        # Verificar consentimento LGPD
        consent = db.execute(
            select(PatientConsent).where(
                PatientConsent.patient_id == subscriber.patient_id,
                PatientConsent.consent_type.in_(("marketing", "email_marketing")),
                PatientConsent.granted == True,
                PatientConsent.revoked_at.is_(None),
            )
        ).scalars().first()

        if consent:
            result["consent_granted"] = True
            result["consent_details"] = {
                "consent_id": consent.id,
                "consent_type": consent.consent_type,
                "granted_at": consent.granted_at.isoformat() if consent.granted_at else None,
                "channel": consent.channel,
                "term_version": consent.term_version,
            }
    else:
        # Sem patient_id — consentimento não é obrigatório
        result["consent_granted"] = True

    return result


# ═══════════════════════════════════════════════════════════════════════════════
#  ANALYTICS OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/analytics/overview", response_model=OverviewMetricsResponse)
def get_overview_metrics(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Metricas globais do modulo de marketing."""
    cache_key = f"emk:analytics:{organization_id}:overview"
    if cached := cache_get_sync(cache_key):
        return cached

    base = select(EmkCampaign).where(EmkCampaign.organization_id == organization_id)
    total_campaigns = db.execute(select(func.count()).select_from(base.subquery())).scalar() or 0

    # Somar metricas de todas as campanhas enviadas
    sent_base = base.where(EmkCampaign.status.in_(["sent", "partial", "sending"]))
    rows = db.execute(sent_base).scalars().all()

    total_sent = sum(c.total_sent for c in rows)
    total_delivered = sum(c.total_delivered for c in rows)
    total_opened = sum(c.total_opened for c in rows)
    total_clicked = sum(c.total_clicked for c in rows)
    total_bounced = sum(c.total_bounced for c in rows)

    # Campanhas recentes (ultimas 5)
    recent = db.execute(
        base.order_by(EmkCampaign.created_at.desc()).limit(5)
    ).scalars().all()

    result = OverviewMetricsResponse(
        total_campaigns=total_campaigns,
        total_sent=total_sent,
        avg_open_rate=round(total_opened / total_delivered * 100, 2) if total_delivered else 0,
        avg_click_rate=round(total_clicked / total_delivered * 100, 2) if total_delivered else 0,
        avg_bounce_rate=round(total_bounced / total_sent * 100, 2) if total_sent else 0,
        recent_campaigns=[CampaignResponse.model_validate(c) for c in recent],
    )
    cache_set_sync(cache_key, result.model_dump(mode="json"), ttl=120)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
#  DOMÍNIOS
# ═══════════════════════════════════════════════════════════════════════════════


def _generate_dns_records(domain: str) -> list[dict]:
    """Gera registros DNS mock para um domínio recém-adicionado."""
    return [
        {
            "record_type": "TXT",
            "name": f"resend._domainkey.{domain}",
            "content": "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...",
            "ttl": "Auto",
            "priority": None,
            "status": "pending",
        },
        {
            "record_type": "MX",
            "name": f"send.{domain}",
            "content": "feedback-smtp.sa-east-1.amazonses.com",
            "ttl": "Auto",
            "priority": 10,
            "status": "pending",
        },
        {
            "record_type": "TXT",
            "name": f"send.{domain}",
            "content": "v=spf1 include:amazonses.com ~all",
            "ttl": "Auto",
            "priority": None,
            "status": "pending",
        },
        {
            "record_type": "MX",
            "name": domain,
            "content": f"inbound-smtp.sa-east-1.amazonaws.com",
            "ttl": "Auto",
            "priority": 10,
            "status": "pending",
        },
    ]


@router.get("/domains", response_model=DomainListResponse)
def list_domains(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
    limit: int = Query(40, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, description="Busca por domínio"),
    status: str | None = Query(None, description="Filtrar por status"),
    region: str | None = Query(None, description="Filtrar por região"),
):
    """Lista domínios da organização (paginado)."""
    base = select(EmkDomain).where(EmkDomain.organization_id == organization_id)
    if q and q.strip():
        base = base.where(EmkDomain.domain.ilike(f"%{q.strip()}%"))
    if status and status.strip():
        base = base.where(EmkDomain.status == status.strip())
    if region and region.strip():
        base = base.where(EmkDomain.region == region.strip())
    total = db.execute(select(func.count()).select_from(base.subquery())).scalar() or 0
    rows = db.execute(base.order_by(EmkDomain.created_at.desc()).limit(limit).offset(offset)).scalars().all()
    return DomainListResponse(
        items=[DomainResponse.model_validate(d) for d in rows],
        total=total, limit=limit, offset=offset,
    )


@router.post("/domains", response_model=DomainResponse, status_code=201)
def create_domain(
    body: DomainCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Adiciona domínio e gera registros DNS."""
    # Verificar duplicata
    existing = db.execute(
        select(EmkDomain).where(
            EmkDomain.organization_id == organization_id,
            EmkDomain.domain == body.domain.lower().strip(),
        )
    ).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail="Domínio já cadastrado nesta organização.")

    domain = EmkDomain(
        organization_id=organization_id,
        domain=body.domain.lower().strip(),
        region=body.region,
        dns_records=_generate_dns_records(body.domain.lower().strip()),
        created_by=user_id,
    )
    db.add(domain)
    db.commit()
    db.refresh(domain)
    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="create", resource_type="emk_domain", resource_id=domain.id,
        data_classification="ADM",
    )
    return DomainResponse.model_validate(domain)


@router.get("/domains/{domain_id}", response_model=DomainResponse)
def get_domain(
    domain_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna domínio por ID com registros DNS."""
    return DomainResponse.model_validate(
        _get_domain_or_404(db, domain_id, organization_id)
    )


@router.put("/domains/{domain_id}", response_model=DomainResponse)
def update_domain(
    domain_id: str,
    body: DomainUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza configuração do domínio (tracking, TLS)."""
    domain = _get_domain_or_404(db, domain_id, organization_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(domain, k, v)
    db.commit()
    db.refresh(domain)
    return DomainResponse.model_validate(domain)


@router.delete("/domains/{domain_id}", status_code=204)
def delete_domain(
    domain_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Remove domínio."""
    domain = _get_domain_or_404(db, domain_id, organization_id)
    db.delete(domain)
    db.commit()
    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="delete", resource_type="emk_domain", resource_id=domain_id,
        data_classification="ADM",
    )
    return None


@router.post("/domains/{domain_id}/verify", response_model=DomainResponse)
def verify_domain(
    domain_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Simula verificação DNS do domínio (em produção, checaria registros reais)."""
    from datetime import datetime as dt, timezone
    domain = _get_domain_or_404(db, domain_id, organization_id)
    # Simular: marcar todos os DNS records como verified
    if domain.dns_records:
        updated_records = []
        for rec in domain.dns_records:
            rec_copy = dict(rec)
            rec_copy["status"] = "verified"
            updated_records.append(rec_copy)
        domain.dns_records = updated_records
    domain.status = "verified"
    domain.provider = "cloudflare"  # simulado
    domain.verified_at = dt.now(timezone.utc)
    db.commit()
    db.refresh(domain)
    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="verify", resource_type="emk_domain", resource_id=domain.id,
        data_classification="ADM",
    )
    return DomainResponse.model_validate(domain)


# ── Envio Avulso (Single Email) ──────────────────────────────────────────────


@router.post("/send-single", status_code=200)
def send_single_email(
    body: SingleEmailRequest,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """
    Envia um email transacional avulso.
    Requer autenticação e permissões de marketing.
    """
    # Validar domínio do from_email se fornecido, caso contrário usa default da org
    from_email = body.from_email
    if from_email:
        _validate_from_email_domain(db, from_email, organization_id)
    else:
        # Tentar pegar um domínio verificado da org
        domain_obj = db.execute(
            select(EmkDomain).where(
                EmkDomain.organization_id == organization_id,
                EmkDomain.status == "verified"
            ).limit(1)
        ).scalars().first()
        
        if domain_obj:
            from_email = f"contato@{domain_obj.domain}"
        else:
            from src.config.settings import get_settings
            settings = get_settings()
            from_email = getattr(settings, "email_from_address", "noreply@completepay.com")

    from_name = body.from_name or "CompletePay"
    from_addr = f"{from_name} <{from_email}>"

    from src.services.esp_adapter import get_esp_adapter
    adapter = get_esp_adapter()
    
    result = adapter.send_single(
        from_addr=from_addr,
        to=body.to_email,
        subject=body.subject,
        html=body.html_content or "",
        text=body.text_content
    )
    
    if not result.success:
        logger.error("Failed to send single email to %s: %s", body.to_email, result.error)
        raise HTTPException(status_code=500, detail=f"Erro ao enviar email: {result.error}")
        
    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="send_single", resource_type="emk_email", resource_id=body.to_email,
        data_classification="ADM",
    )
    
    return {"message": "Email enviado com sucesso", "esp_id": result.message_id}
