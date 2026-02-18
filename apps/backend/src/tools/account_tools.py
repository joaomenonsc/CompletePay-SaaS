"""Tools de conta: check_balance, get_transactions."""
from agno.tools import tool

from src.tools.repositories import get_account_repository


@tool
def check_balance(account_id: str) -> str:
    """Consulta o saldo de uma conta.

    Args:
        account_id: ID da conta.
    """
    repo = get_account_repository()
    balance = repo.get_balance(account_id)
    if not balance:
        return f"Conta {account_id} nao encontrada."
    return f"Saldo: {balance.amount} {balance.currency}"


@tool
def get_transactions(account_id: str, limit: int = 10) -> str:
    """Lista as ultimas transacoes de uma conta.

    Args:
        account_id: ID da conta.
        limit: Quantidade maxima de transacoes (padrao 10).
    """
    repo = get_account_repository()
    items = repo.get_transactions(account_id, limit=limit)
    if not items:
        return f"Nenhuma transacao encontrada para a conta {account_id}."
    lines = [f"- {t.id}: {t.amount} {t.currency} ({t.status}) - {t.description}" for t in items]
    return "Transacoes:\n" + "\n".join(lines)
