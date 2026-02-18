"""Tools de pagamento: process_payment, refund_payment, check_status, process_high_value_payment (HITL)."""
from agno.tools import tool

from src.config.settings import get_settings
from src.models.payment import PaymentRequest
from src.tools.repositories import get_payment_repository


@tool
def process_payment(
    amount: float,
    currency: str,
    recipient_id: str,
    description: str = "",
) -> str:
    """Processa um pagamento no sistema CompletePay.

    Args:
        amount: Valor do pagamento (maior que zero).
        currency: Moeda (BRL, USD, EUR).
        recipient_id: ID do destinatario.
        description: Descricao opcional do pagamento.
    """
    repo = get_payment_repository()
    req = PaymentRequest(amount=amount, currency=currency, recipient_id=recipient_id, description=description)
    result = repo.process_payment(req)
    return f"{result.message} ID: {result.transaction_id}"


@tool
def refund_payment(transaction_id: str, reason: str = "Solicitacao do cliente") -> str:
    """Estorna um pagamento existente.

    Args:
        transaction_id: ID da transacao a estornar.
        reason: Motivo do estorno.
    """
    repo = get_payment_repository()
    result = repo.refund_payment(transaction_id, reason)
    return result.message


@tool
def check_status(transaction_id: str) -> str:
    """Consulta o status de uma transacao.

    Args:
        transaction_id: ID da transacao.
    """
    repo = get_payment_repository()
    tx = repo.get_transaction(transaction_id)
    if not tx:
        return f"Transacao {transaction_id} nao encontrada."
    return f"Status: {tx.status}. Valor: {tx.amount} {tx.currency}. Destinatario: {tx.recipient_id}."


@tool
def process_high_value_payment(
    amount: float,
    currency: str,
    recipient_id: str,
    description: str = "",
) -> str:
    """Processa pagamento de alto valor (requer aprovacao humana acima do limite).

    Use para valores acima do limite automatico. Abaixo do limite, o pagamento
    e processado normalmente; acima, a operacao nao e executada e deve ser
    encaminhada ao fluxo de aprovacao humana (Seção 8.3).

    Args:
        amount: Valor do pagamento.
        currency: Moeda (BRL, USD, EUR).
        recipient_id: ID do destinatario.
        description: Descricao opcional.
    """
    threshold = get_settings().high_value_threshold
    if amount <= threshold:
        repo = get_payment_repository()
        req = PaymentRequest(
            amount=amount,
            currency=currency,
            recipient_id=recipient_id,
            description=description,
        )
        result = repo.process_payment(req)
        return f"{result.message} ID: {result.transaction_id}"
    return (
        f"Pagamento de {amount} {currency} para {recipient_id} excede o limite "
        f"automatico ({threshold}). Encaminhe para aprovacao humana antes de executar."
    )
