"""Testes das tools de conta (Fase 3)."""

from src.tools.account_tools import check_balance, get_transactions


def _call_tool(tool_obj, *args, **kwargs):
    if hasattr(tool_obj, "entrypoint") and tool_obj.entrypoint is not None:
        return tool_obj.entrypoint(*args, **kwargs)
    return tool_obj(*args, **kwargs)


class TestAccountTools:
    def test_check_balance_returns_balance_string(self):
        result = _call_tool(check_balance, "acc-1")
        assert isinstance(result, str)
        assert "Saldo" in result or "BRL" in result

    def test_get_transactions_returns_list_string(self):
        result = _call_tool(get_transactions, "acc-1", 5)
        assert isinstance(result, str)
        assert "Transacoes" in result or "transacao" in result.lower() or "- " in result
