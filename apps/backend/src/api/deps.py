"""Dependencias FastAPI: contexto de organizacao (Fase 4.1) e RBAC CRM Saude."""
from typing import Callable

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
    org_id = x_organization_id.strip().lower()
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


def _normalize_role(role: str | None) -> str | None:
    """Retorna role normalizado (lowercase) ou None."""
    if not role or not role.strip():
        return None
    return role.strip().lower()


def require_org_role(allowed_roles: list[str]):
    """
    Dependency factory: exige que o usuario tenha um dos roles permitidos na organizacao.
    Usa o role do UserOrganization (nao do JWT). Aceita 'owner' como equivalente a 'gcl'.
    Uso: Depends(require_org_role(["med", "enf"])).
    """

    def _dependency(
        user_id: str = Depends(require_user_id),
        organization_id: str = Depends(require_organization_id),
        db: Session = Depends(get_db),
    ) -> str:
        role = get_membership_role(db, user_id, organization_id)
        if role is None:
            raise HTTPException(
                status_code=403,
                detail="Usuario nao e membro desta organizacao.",
            )
        r = _normalize_role(role)
        allowed = {_normalize_role(a) for a in allowed_roles}
        # owner equivale a gcl no contexto CRM
        if r == "owner":
            r = "gcl"
        if r not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Acesso negado: role '{role}' nao tem permissao para esta operacao.",
            )
        return role

    return _dependency


def require_data_access(classification: str, allowed_roles: list[str]) -> Callable:
    """
    Dependency factory: exige role permitido para acessar dados da classificacao dada.
    Combinacao de require_org_role com classificacao (ADM, CLI, FIN) para uso em rotas CRM.
    Uso: Depends(require_data_access("CLI", ["med", "enf", "gcl"])).
    """

    def _dependency(
        user_id: str = Depends(require_user_id),
        organization_id: str = Depends(require_organization_id),
        db: Session = Depends(get_db),
    ) -> str:
        role = get_membership_role(db, user_id, organization_id)
        if role is None:
            raise HTTPException(
                status_code=403,
                detail="Usuario nao e membro desta organizacao.",
            )
        r = _normalize_role(role)
        if r == "owner":
            r = "gcl"
        allowed = {_normalize_role(a) for a in allowed_roles}
        if r not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Acesso negado: role '{role}' nao tem permissao para dados '{classification}'.",
            )
        return role

    return _dependency
