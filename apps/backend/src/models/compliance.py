"""Schemas Pydantic para compliance."""
from pydantic import BaseModel, Field


class IdentityVerificationResult(BaseModel):
    """Resultado da verificacao de identidade."""

    verified: bool
    level: str = Field("", description="Nivel: pending, basic, full")
    message: str = ""


class AuditLogEntry(BaseModel):
    """Entrada de log de auditoria."""

    action: str
    entity_type: str
    entity_id: str
    user_id: str = ""
    details: str = ""
