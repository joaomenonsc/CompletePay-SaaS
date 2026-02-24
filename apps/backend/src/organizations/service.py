"""Servico de organizacoes: CRUD e membership (Fase 4.1)."""
import uuid as uuid_module
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from src.auth.repository import get_user_by_email, get_user_by_id
from src.db.models import Organization, UserOrganization


def _normalize_user_id(user_id: str) -> str:
    """Normaliza user_id para formato UUID canonico (lowercase com hifens)."""
    if not user_id or not user_id.strip():
        return (user_id or "").strip()
    s = user_id.strip().lower()
    try:
        return str(uuid_module.UUID(s))
    except (ValueError, TypeError):
        return s


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
    uid = _normalize_user_id(user_id)
    rows = (
        db.execute(
            select(Organization, UserOrganization.role).join(
                UserOrganization,
                UserOrganization.organization_id == Organization.id,
            ).where(UserOrganization.user_id == uid)
        )
        .all()
    )
    return [(org, role) for org, role in rows]


def get_membership_role(db: Session, user_id: str, organization_id: str) -> str | None:
    """Retorna o role do usuario na org ou None se nao for membro."""
    uid = _normalize_user_id(user_id)
    oid = (organization_id or "").strip().lower()
    # scalars().one_or_none() retorna o valor direto (ex: "owner"), nao uma Row
    role_val = (
        db.execute(
            select(UserOrganization.role).where(
                UserOrganization.user_id == uid,
                UserOrganization.organization_id == oid,
            )
        )
        .scalars().one_or_none()
    )
    if role_val is None:
        return None
    return str(role_val).strip() if role_val else None


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


def update_organization(
    db: Session,
    org_id: str,
    *,
    name: str | None = None,
    slug: str | None = None,
    avatar_url: str | None = None,
) -> Organization | None:
    """Atualiza name, slug e/ou avatar_url da organizacao. Retorna a org atualizada ou None se nao existir.
    Nao verifica unicidade do slug; a rota deve fazer isso antes de chamar.
    Para avatar_url, use omit para nao alterar; use "" ou None para remover (usar iniciais)."""
    org = get_organization_by_id(db, org_id)
    if not org:
        return None
    if name is not None:
        org.name = name.strip()
    if slug is not None:
        org.slug = slug.strip().lower()
    if avatar_url is not None:
        org.avatar_url = (avatar_url.strip() or None) if avatar_url else None
    db.commit()
    db.refresh(org)
    return org


def list_organization_members(db: Session, organization_id: str) -> list[dict]:
    """Lista membros da organizacao com dados do usuario (id, email, name, avatarUrl, role)."""
    rows = (
        db.execute(
            select(UserOrganization.user_id, UserOrganization.role).where(
                UserOrganization.organization_id == organization_id,
            )
        )
        .all()
    )
    result = []
    for user_id, role in rows:
        user = get_user_by_id(str(user_id))
        if user:
            result.append({
                "userId": str(user.id),
                "email": user.email or "",
                "name": getattr(user, "name", None) or "",
                "avatarUrl": getattr(user, "avatar_url", None) or None,
                "role": role,
            })
    return result


def add_organization_member(
    db: Session, organization_id: str, email: str, role: str
) -> dict | None:
    """Adiciona usuario à organizacao pelo email. Retorna dados do membro ou None se falhar."""
    user = get_user_by_email(email.strip())
    if not user:
        return None
    user_id = str(user.id)
    existing = (
        db.execute(
            select(UserOrganization).where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.user_id == user_id,
            )
        )
        .scalars().one_or_none()
    )
    if existing:
        return None  # ja e membro
    uo = UserOrganization(
        user_id=user_id,
        organization_id=organization_id,
        role=(role or "member").strip() or "member",
    )
    db.add(uo)
    db.commit()
    return {
        "userId": user_id,
        "email": user.email or "",
        "name": getattr(user, "name", None) or "",
        "avatarUrl": getattr(user, "avatar_url", None) or None,
        "role": (role or "member").strip() or "member",
    }


def remove_organization_member(
    db: Session, organization_id: str, user_id: str
) -> bool:
    """Remove membro da organizacao. Retorna True se removeu."""
    result = db.execute(
        delete(UserOrganization).where(
            UserOrganization.organization_id == organization_id,
            UserOrganization.user_id == user_id,
        )
    )
    db.commit()
    return result.rowcount > 0


def update_member_role(
    db: Session, organization_id: str, user_id: str, role: str
) -> bool:
    """Atualiza a funcao do membro. Retorna True se atualizou."""
    uo = (
        db.execute(
            select(UserOrganization).where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.user_id == user_id,
            )
        )
        .scalars().one_or_none()
    )
    if not uo:
        return False
    uo.role = (role or "member").strip() or "member"
    db.commit()
    return True


def count_owners(db: Session, organization_id: str) -> int:
    """Quantidade de owners na organizacao."""
    r = (
        db.execute(
            select(func.count()).select_from(UserOrganization).where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.role == "owner",
            )
        )
        .scalar()
    )
    return r or 0
