"""Schemas Pydantic para conta."""
from pydantic import BaseModel, Field


class Balance(BaseModel):
    """Saldo da conta."""

    amount: float = Field(..., description="Valor disponivel")
    currency: str = Field("BRL", description="Moeda")


class TransactionSummary(BaseModel):
    """Resumo de uma transacao para listagem."""

    id: str
    amount: float
    currency: str
    status: str
    description: str = ""
