"""Servico de auditoria do CRM: log imutavel de operacoes em dados sensiveis."""
from typing import Any, Optional

from sqlalchemy.orm import Session

from src.db.models_crm import AuditLog


def log_audit(
    db: Session,
    organization_id: str,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    data_classification: Optional[str] = None,
    data_before: Optional[dict[str, Any]] = None,
    data_after: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    justification: Optional[str] = None,
) -> AuditLog:
    """
    Registra uma operacao no log de auditoria (append-only).
    action: create, read, update, delete
    data_classification: ADM, CLI, FIN
    justification: obrigatorio para break-glass e certas acoes sobre dados CLI/SEC.
    """
    entry = AuditLog(
        organization_id=organization_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        data_classification=data_classification,
        data_before=data_before,
        data_after=data_after,
        ip_address=ip_address,
        justification=justification,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
