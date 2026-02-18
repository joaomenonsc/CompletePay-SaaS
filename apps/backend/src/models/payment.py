"""Schemas Pydantic para pagamentos."""
from pydantic import BaseModel, Field


class PaymentRequest(BaseModel):
    """Requisicao de pagamento."""

    amount: float = Field(..., gt=0, description="Valor do pagamento")
    currency: str = Field(..., min_length=3, max_length=3, description="Moeda (BRL, USD, EUR)")
    recipient_id: str = Field(..., description="ID do destinatario")
    description: str = Field("", description="Descricao do pagamento")


class PaymentResult(BaseModel):
    """Resultado de um pagamento."""

    transaction_id: str
    status: str = "completed"
    amount: float
    currency: str
    message: str = ""


class Transaction(BaseModel):
    """Transacao (consulta)."""

    id: str
    amount: float
    currency: str
    status: str
    recipient_id: str
    description: str = ""
