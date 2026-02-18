"""Testes das tools de pagamento (Fase 3)."""

from src.tools.payment_tools import check_status, process_payment, refund_payment


def _call_tool(tool_obj, *args, **kwargs):
    """Chama a funcao subjacente (Agno retorna Function com entrypoint)."""
    if hasattr(tool_obj, "entrypoint") and tool_obj.entrypoint is not None:
        return tool_obj.entrypoint(*args, **kwargs)
    return tool_obj(*args, **kwargs)


class TestPaymentTools:
    def test_process_payment_returns_string_with_id(self):
        result = _call_tool(process_payment, 50.0, "BRL", "rec-1", "")
        assert isinstance(result, str)
        assert "ID:" in result or "processado" in result.lower()

    def test_refund_payment_returns_message(self):
        result = _call_tool(refund_payment, "tx-123", "Teste estorno")
        assert isinstance(result, str)
        assert "Estorno" in result or "refund" in result.lower()

    def test_check_status_returns_status_info(self):
        result = _call_tool(check_status, "tx-1")
        assert isinstance(result, str)
        assert "Status" in result or "status" in result.lower()
