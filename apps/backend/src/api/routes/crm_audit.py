"""Rotas CRM: Logs de auditoria. Apenas role gcl."""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.api.deps import require_organization_id, require_org_role
from src.api.middleware.auth import require_user_id
from src.db.models_crm import AuditLog
from src.db.session import get_db
from src.schemas.crm import AuditLogListResponse, AuditLogResponse

logger = logging.getLogger("completepay.crm")

router = APIRouter(prefix="/audit-logs", tags=["crm-audit"])


@router.get("", response_model=AuditLogListResponse)
def list_audit_logs(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(["gcl"])),
    db: Session = Depends(get_db),
    resource_type: str | None = Query(None, description="Filtro por tipo de recurso"),
    user_id_filter: str | None = Query(None, alias="userId", description="Filtro por usuario"),
    data_classification: str | None = Query(None, description="Filtro por classificacao ADM/CLI/FIN"),
    since: datetime | None = Query(None, description="Inicio do periodo"),
    until: datetime | None = Query(None, description="Fim do periodo"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Lista logs de auditoria. Apenas gestor clinico (gcl)."""
    base = select(AuditLog).where(AuditLog.organization_id == organization_id)
    if resource_type:
        base = base.where(AuditLog.resource_type == resource_type)
    if user_id_filter:
        base = base.where(AuditLog.user_id == user_id_filter)
    if data_classification:
        base = base.where(AuditLog.data_classification == data_classification)
    if since:
        base = base.where(AuditLog.created_at >= since)
    if until:
        base = base.where(AuditLog.created_at <= until)

    total = db.execute(select(func.count()).select_from(base.subquery())).scalar() or 0
    rows = (
        db.execute(
            base.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
        )
        .scalars()
        .all()
    )
    logs = [row[0] for row in rows]

    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
        limit=limit,
        offset=offset,
    )
