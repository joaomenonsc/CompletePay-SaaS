"""Schemas Pydantic para API de organizacoes (Fase 4.1)."""
from pydantic import BaseModel, Field, field_validator


class OrganizationCreate(BaseModel):
    """Payload para criar organizacao."""

    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=64, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

    @field_validator("slug")
    @classmethod
    def slug_lower(cls, v: str) -> str:
        return v.strip().lower()


class OrganizationResponse(BaseModel):
    """Resposta de organizacao (lista ou detalhe)."""

    id: str
    name: str
    slug: str
    createdAt: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row) -> "OrganizationResponse":
        return cls(
            id=row.id,
            name=row.name,
            slug=row.slug,
            createdAt=row.created_at.isoformat() if row.created_at else "",
        )


class OrganizationMemberResponse(BaseModel):
    """Resposta com role do usuario na org (opcional)."""

    id: str
    name: str
    slug: str
    role: str
    createdAt: str

    @classmethod
    def from_membership(cls, org, role: str) -> "OrganizationMemberResponse":
        return cls(
            id=org.id,
            name=org.name,
            slug=org.slug,
            role=role,
            createdAt=org.created_at.isoformat() if org.created_at else "",
        )
