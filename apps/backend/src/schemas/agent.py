"""Schemas Pydantic para API de agentes (request/response)."""
from typing import Optional

from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: str = Field(default="rascunho", pattern="^(ativo|rascunho|pausado)$")
    model: str = Field(..., min_length=1, max_length=128)
    system_instructions: str = Field(default="", max_length=65535)
    category: Optional[str] = None
    template_id: Optional[str] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(ativo|rascunho|pausado)$")
    model: Optional[str] = Field(None, min_length=1, max_length=128)
    system_instructions: Optional[str] = None
    category: Optional[str] = None
    template_id: Optional[str] = None


class AgentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: str
    model: str
    system_instructions: str
    category: Optional[str] = None
    template_id: Optional[str] = None
    createdAt: str
    updatedAt: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row) -> "AgentResponse":
        return cls(
            id=row.id,
            name=row.name,
            description=row.description,
            image_url=row.image_url,
            status=row.status,
            model=row.model,
            system_instructions=row.system_instructions,
            category=row.category,
            template_id=row.template_id,
            createdAt=row.created_at.isoformat() if row.created_at else "",
            updatedAt=row.updated_at.isoformat() if row.updated_at else "",
        )
