"""Testes das tools de suporte (Fase 3)."""

from src.tools.support_tools import create_ticket, get_faq


def _call_tool(tool_obj, *args, **kwargs):
    if hasattr(tool_obj, "entrypoint") and tool_obj.entrypoint is not None:
        return tool_obj.entrypoint(*args, **kwargs)
    return tool_obj(*args, **kwargs)


class TestSupportTools:
    def test_create_ticket_returns_ticket_id(self):
        result = _call_tool(create_ticket, "Erro no pagamento", "Falha ao concluir", "high")
        assert isinstance(result, str)
        assert "TKT-" in result or "Ticket" in result or "criado" in result.lower()

    def test_get_faq_returns_qa_content(self):
        result = _call_tool(get_faq)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_get_faq_with_category(self):
        result = _call_tool(get_faq, "conta")
        assert isinstance(result, str)
