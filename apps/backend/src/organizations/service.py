"""Servico de organizacoes: CRUD e membership (Fase 4.1)."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.models import Organization, UserOrganization


def create_organization(
    db: Session, name: str, slug: str, owner_user_id: str
) -> Organization:
    """Cria organizacao e adiciona owner_user_id como owner. Retorna a org."""
    org = Organization(name=name.strip(), slug=slug.strip().lower())
    db.add(org)
    db.flush()
    uo = UserOrganization(
        user_id=owner_user_id,
        organization_id=org.id,
        role="owner",
    )
    db.add(uo)
    db.commit()
    db.refresh(org)
    return org


def list_organizations_for_user(db: Session, user_id: str) -> list[tuple[Organization, str]]:
    """Retorna lista de (Organization, role) para o usuario."""
    rows = (
        db.execute(
            select(Organization, UserOrganization.role).join(
                UserOrganization,
                UserOrganization.organization_id == Organization.id,
            ).where(UserOrganization.user_id == user_id)
        )
        .all()
    )
    return [(org, role) for org, role in rows]


def get_membership_role(db: Session, user_id: str, organization_id: str) -> str | None:
    """Retorna o role do usuario na org ou None se nao for membro."""
    row = (
        db.execute(
            select(UserOrganization.role).where(
                UserOrganization.user_id == user_id,
                UserOrganization.organization_id == organization_id,
            )
        )
        .scalars().one_or_none()
    )
    return row[0] if row else None


def is_member(db: Session, user_id: str, organization_id: str) -> bool:
    """Verifica se o usuario e membro da organizacao."""
    return get_membership_role(db, user_id, organization_id) is not None


def get_organization_by_slug(db: Session, slug: str) -> Organization | None:
    """Retorna organizacao pelo slug ou None."""
    return (
        db.execute(select(Organization).where(Organization.slug == slug.strip().lower()))
        .scalars().one_or_none()
    )


def get_organization_by_id(db: Session, org_id: str) -> Organization | None:
    """Retorna organizacao pelo id ou None."""
    return (
        db.execute(select(Organization).where(Organization.id == org_id))
        .scalars().one_or_none()
    )
