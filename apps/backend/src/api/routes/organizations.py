"""Rotas REST para organizacoes (Fase 4.1). Listar minhas orgs, criar org."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.api.middleware.auth import require_user_id
from src.db.session import get_db
from src.organizations.service import (
    create_organization,
    get_organization_by_slug,
    list_organizations_for_user,
)
from src.schemas.organization import (
    OrganizationCreate,
    OrganizationMemberResponse,
    OrganizationResponse,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationMemberResponse])
def list_my_organizations(
    user_id: str = Depends(require_user_id),
    db: Session = Depends(get_db),
):
    """Lista organizacoes do usuario autenticado (com role em cada uma)."""
    pairs = list_organizations_for_user(db, user_id)
    return [OrganizationMemberResponse.from_membership(org, role) for org, role in pairs]


@router.post("", response_model=OrganizationResponse, status_code=201)
def create_org(
    body: OrganizationCreate,
    user_id: str = Depends(require_user_id),
    db: Session = Depends(get_db),
):
    """Cria uma nova organizacao e adiciona o usuario como owner."""
    existing = get_organization_by_slug(db, body.slug)
    if existing:
        raise HTTPException(status_code=400, detail="Slug de organizacao ja em uso.")
    org = create_organization(db, body.name, body.slug, user_id)
    return OrganizationResponse.from_orm_row(org)
