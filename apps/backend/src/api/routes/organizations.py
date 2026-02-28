"""Rotas REST para organizacoes (Fase 4.1). Listar minhas orgs, criar org, atualizar org."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from src.api.deps import require_organization_id
from src.api.middleware.auth import require_user_id
from src.db.session import get_db
from src.organizations.service import (
    add_organization_member,
    count_owners,
    create_organization,
    get_organization_by_id,
    get_organization_by_slug,
    get_membership_role,
    list_organization_members,
    list_organizations_for_user,
    remove_organization_member,
    update_organization,
    update_member_role,
)
from src.schemas.organization import (
    InviteMemberBody,
    OrganizationCreate,
    OrganizationMemberResponse,
    OrganizationResponse,
    OrganizationUpdate,
    OrgMemberItem,
    UpdateMemberRoleBody,
)
from src.services.avatar_storage import save_avatar

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


@router.patch("/{organization_id}", response_model=OrganizationResponse)
def update_org(
    organization_id: str,
    body: OrganizationUpdate,
    user_id: str = Depends(require_user_id),
    organization_id_header: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Atualiza nome e/ou slug da organizacao. So pode atualizar a org do header X-Organization-Id."""
    if organization_id != organization_id_header:
        raise HTTPException(
            status_code=403,
            detail="So e possivel atualizar a organizacao atualmente selecionada.",
        )
    org = get_organization_by_id(db, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organizacao nao encontrada.")

    payload = body.model_dump(exclude_unset=True)
    if "slug" in payload and payload["slug"]:
        slug_clean = payload["slug"].strip().lower()
        if slug_clean != org.slug:
            existing = get_organization_by_slug(db, slug_clean)
            if existing and existing.id != organization_id:
                raise HTTPException(status_code=400, detail="Slug de organizacao ja em uso.")

    updated = update_organization(
        db,
        organization_id,
        name=payload.get("name"),
        slug=payload.get("slug"),
        avatar_url=payload["avatar_url"] if "avatar_url" in payload else None,
    )
    return OrganizationResponse.from_orm_row(updated)


ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
AVATAR_MAX_BYTES = 5 * 1024 * 1024
EXT_BY_CONTENT_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
}


@router.post("/{organization_id}/avatar", response_model=OrganizationResponse)
def upload_org_avatar(
    organization_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(require_user_id),
    organization_id_header: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Envia uma foto para o avatar da organizacao. JPEG, PNG, GIF ou WebP ate 5MB."""
    if organization_id != organization_id_header:
        raise HTTPException(
            status_code=403,
            detail="So e possivel alterar a organizacao atualmente selecionada.",
        )
    org = get_organization_by_id(db, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organizacao nao encontrada.")
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Formato invalido. Use JPEG, PNG, GIF ou WebP.",
        )
    contents = file.file.read()
    if len(contents) > AVATAR_MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Arquivo muito grande. Maximo 5MB.",
        )
    ext = EXT_BY_CONTENT_TYPE.get(file.content_type, "jpg")
    safe_id = organization_id.replace("-", "")[:32]
    pathname = f"avatars/org-{safe_id}.{ext}"
    try:
        avatar_url = save_avatar(pathname, contents, file.content_type or "image/jpeg")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    updated = update_organization(db, organization_id, avatar_url=avatar_url)
    return OrganizationResponse.from_orm_row(updated)


# ---- Membros ----

def _normalize_org_id(org_id: str) -> str:
    """Normaliza UUID da organizacao para comparacao (lowercase)."""
    return (org_id or "").strip().lower()


def _require_org_member(
    organization_id: str,
    organization_id_header: str,
    user_id: str,
    db: Session,
) -> str:
    """Garante que a org e a do header e que o usuario e membro. Retorna o role do usuario."""
    oid = _normalize_org_id(organization_id)
    oid_header = _normalize_org_id(organization_id_header)
    if oid != oid_header:
        raise HTTPException(
            status_code=403,
            detail="So e possivel acessar a organizacao atualmente selecionada.",
        )
    role = get_membership_role(db, user_id, oid)
    if not role:
        raise HTTPException(status_code=404, detail="Organizacao nao encontrada ou voce nao e membro.")
    return role


def _require_owner(role: str) -> None:
    """Exige role owner ou gcl (gestor clinico) para acoes administrativas."""
    if not role:
        raise HTTPException(
            status_code=403,
            detail="Apenas proprietarios ou gestores clinicos podem executar esta acao.",
        )
    r = role.strip().lower()
    if r not in ("owner", "gcl"):
        raise HTTPException(
            status_code=403,
            detail="Apenas proprietarios ou gestores clinicos podem executar esta acao.",
        )


@router.get("/{organization_id}/members", response_model=list[OrgMemberItem])
def list_org_members(
    organization_id: str,
    user_id: str = Depends(require_user_id),
    organization_id_header: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Lista membros da organizacao. Requer ser membro."""
    _require_org_member(organization_id, organization_id_header, user_id, db)
    oid = _normalize_org_id(organization_id)
    members = list_organization_members(db, oid)
    return [OrgMemberItem(**m) for m in members]


@router.post("/{organization_id}/members", response_model=OrgMemberItem, status_code=201)
def invite_org_member(
    organization_id: str,
    body: InviteMemberBody,
    user_id: str = Depends(require_user_id),
    organization_id_header: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Adiciona membro por email. Usuario deve ja existir na plataforma. Apenas owners."""
    oid = _normalize_org_id(organization_id)
    role = _require_org_member(organization_id, organization_id_header, user_id, db)
    _require_owner(role)
    org = get_organization_by_id(db, oid)
    if not org:
        raise HTTPException(status_code=404, detail="Organizacao nao encontrada.")
    member = add_organization_member(db, oid, body.email, body.role)
    if not member:
        raise HTTPException(
            status_code=400,
            detail="Usuario nao encontrado com este e-mail ou ja e membro da organizacao.",
        )
    return OrgMemberItem(**member)


@router.delete("/{organization_id}/members/{member_user_id}")
def remove_org_member(
    organization_id: str,
    member_user_id: str,
    user_id: str = Depends(require_user_id),
    organization_id_header: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Remove membro (ou sai da org se member_user_id for o proprio usuario). Apenas owner pode remover outros."""
    role = _require_org_member(organization_id, organization_id_header, user_id, db)
    oid = _normalize_org_id(organization_id)
    if member_user_id != user_id:
        _require_owner(role)
    if member_user_id == user_id:
        if role.strip().lower() == "owner" and count_owners(db, oid) <= 1:
            raise HTTPException(
                status_code=400,
                detail="Transfira a propriedade antes de sair ou adicione outro proprietario.",
            )
    ok = remove_organization_member(db, oid, member_user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Membro nao encontrado.")
    return {"message": "Membro removido."}


@router.patch("/{organization_id}/members/{member_user_id}", response_model=OrgMemberItem)
def patch_org_member_role(
    organization_id: str,
    member_user_id: str,
    body: UpdateMemberRoleBody,
    user_id: str = Depends(require_user_id),
    organization_id_header: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Altera a funcao do membro. Apenas owners."""
    role = _require_org_member(organization_id, organization_id_header, user_id, db)
    _require_owner(role)
    oid = _normalize_org_id(organization_id)
    ok = update_member_role(db, oid, member_user_id, body.role)
    if not ok:
        raise HTTPException(status_code=404, detail="Membro nao encontrado.")
    members = list_organization_members(db, oid)
    found = next((m for m in members if m["userId"] == member_user_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="Membro nao encontrado.")
    return OrgMemberItem(**found)
