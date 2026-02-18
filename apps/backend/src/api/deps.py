"""Dependencias FastAPI: contexto de organizacao (Fase 4.1)."""
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from src.api.middleware.auth import require_user_id
from src.db.session import get_db
from src.organizations.service import get_membership_role


def require_organization_id(
    x_organization_id: str | None = Header(None, alias="X-Organization-Id"),
    user_id: str = Depends(require_user_id),
    db: Session = Depends(get_db),
) -> str:
    """
    Exige header X-Organization-Id e que o usuario autenticado seja membro da org.
    Retorna organization_id.
    """
    if not x_organization_id or not x_organization_id.strip():
        raise HTTPException(
            status_code=400,
            detail="Header X-Organization-Id e obrigatorio para esta rota.",
        )
    org_id = x_organization_id.strip()
    role = get_membership_role(db, user_id, org_id)
    if role is None:
        raise HTTPException(
            status_code=403,
            detail="Usuario nao e membro desta organizacao.",
        )
    return org_id


def get_organization_id_optional(
    x_organization_id: str | None = Header(None, alias="X-Organization-Id"),
) -> str | None:
    """Retorna X-Organization-Id se presente, senao None. Nao valida membership."""
    return x_organization_id.strip() if x_organization_id else None
