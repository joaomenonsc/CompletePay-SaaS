"""Schemas Pydantic para API de organizacoes (Fase 4.1)."""
from pydantic import BaseModel, ConfigDict, Field, field_validator


class OrganizationCreate(BaseModel):
    """Payload para criar organizacao."""

    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

    @field_validator("slug")
    @classmethod
    def slug_lower(cls, v: str) -> str:
        return v.strip().lower()


class OrganizationUpdate(BaseModel):
    """Payload para atualizar organizacao (partial)."""

    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(None, min_length=1, max_length=255)
    slug: str | None = Field(None, min_length=1, max_length=64, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    avatar_url: str | None = Field(None, alias="avatarUrl")

    @field_validator("slug")
    @classmethod
    def slug_lower(cls, v: str | None) -> str | None:
        return v.strip().lower() if v else None


class OrganizationResponse(BaseModel):
    """Resposta de organizacao (lista ou detalhe)."""

    id: str
    name: str
    slug: str
    avatarUrl: str | None = None
    createdAt: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row) -> "OrganizationResponse":
        return cls(
            id=row.id,
            name=row.name,
            slug=row.slug,
            avatarUrl=getattr(row, "avatar_url", None) or None,
            createdAt=row.created_at.isoformat() if row.created_at else "",
        )


class OrganizationMemberResponse(BaseModel):
    """Resposta com role do usuario na org (opcional)."""

    id: str
    name: str
    slug: str
    avatarUrl: str | None = None
    role: str
    createdAt: str

    @classmethod
    def from_membership(cls, org, role: str) -> "OrganizationMemberResponse":
        return cls(
            id=org.id,
            name=org.name,
            slug=org.slug,
            avatarUrl=getattr(org, "avatar_url", None) or None,
            role=role,
            createdAt=org.created_at.isoformat() if org.created_at else "",
        )


class OrgMemberItem(BaseModel):
    """Item da lista de membros da organizacao."""

    userId: str
    email: str
    name: str
    avatarUrl: str | None = None
    role: str


class InviteMemberBody(BaseModel):
    """Payload para convidar/adicionar membro por email."""

    email: str = Field(..., min_length=1)
    role: str = Field("member", pattern=r"^(owner|member)$")


class UpdateMemberRoleBody(BaseModel):
    """Payload para alterar funcao do membro."""

    role: str = Field(..., pattern=r"^(owner|member)$")
