"""Testes das tools de compliance (Fase 3)."""

from src.tools.compliance_tools import audit_log, verify_identity


def _call_tool(tool_obj, *args, **kwargs):
    if hasattr(tool_obj, "entrypoint") and tool_obj.entrypoint is not None:
        return tool_obj.entrypoint(*args, **kwargs)
    return tool_obj(*args, **kwargs)


class TestComplianceTools:
    def test_verify_identity_returns_verification_message(self):
        result = _call_tool(verify_identity, "user-1")
        assert isinstance(result, str)
        assert "verificad" in result.lower() or "identidade" in result.lower()

    def test_audit_log_returns_confirmation(self):
        result = _call_tool(audit_log, "payment_created", "transaction", "tx-1", "test")
        assert isinstance(result, str)
        assert "Auditoria" in result or "registrad" in result.lower()
