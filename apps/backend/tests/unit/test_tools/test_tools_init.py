"""Testes dos exports e get_all_tools (Fase 3)."""
import os
from unittest.mock import patch


from src.tools import (
    ALL_CUSTOM_TOOLS,
    ACCOUNT_TOOLS,
    COMPLIANCE_TOOLS,
    PAYMENT_TOOLS,
    SUPPORT_TOOLS,
    get_all_tools,
)


class TestToolsExports:
    def test_payment_tools_count(self):
        assert len(PAYMENT_TOOLS) == 3

    def test_account_tools_count(self):
        assert len(ACCOUNT_TOOLS) == 2

    def test_support_tools_count(self):
        assert len(SUPPORT_TOOLS) == 2

    def test_compliance_tools_count(self):
        assert len(COMPLIANCE_TOOLS) == 2

    def test_all_custom_tools_is_concatenation(self):
        assert len(ALL_CUSTOM_TOOLS) == len(PAYMENT_TOOLS) + len(ACCOUNT_TOOLS) + len(SUPPORT_TOOLS) + len(COMPLIANCE_TOOLS)

    def test_get_all_tools_includes_custom_without_mcp(self):
        with patch.dict(os.environ, {}, clear=False):
            # Remove MCP_SERVER_URL se existir para testar sem MCP
            os.environ.pop("MCP_SERVER_URL", None)
        tools = get_all_tools(include_mcp=True)
        assert len(tools) >= len(ALL_CUSTOM_TOOLS)
        # Sem MCP configurado, deve ser igual
        assert len(tools) == len(ALL_CUSTOM_TOOLS)

    def test_get_all_tools_without_mcp(self):
        tools = get_all_tools(include_mcp=False)
        assert tools == ALL_CUSTOM_TOOLS
