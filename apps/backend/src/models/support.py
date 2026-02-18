"""Schemas Pydantic para suporte."""
from pydantic import BaseModel, Field


class TicketCreate(BaseModel):
    """Criacao de ticket de suporte."""

    subject: str = Field(..., description="Assunto")
    description: str = Field(..., description="Descricao do problema")
    priority: str = Field("medium", description="Prioridade: low, medium, high")


class TicketResult(BaseModel):
    """Resultado da criacao de ticket."""

    ticket_id: str
    status: str = "open"
    message: str = ""


class FAQItem(BaseModel):
    """Item de FAQ."""

    question: str
    answer: str
    category: str = ""
