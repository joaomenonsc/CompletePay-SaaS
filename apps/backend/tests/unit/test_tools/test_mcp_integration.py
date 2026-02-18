"""Testes da integracao MCP (Fase 3)."""
import os
from unittest.mock import patch


from src.tools.mcp_integration import get_mcp_tools


class TestMCPIntegration:
    def test_get_mcp_tools_returns_none_when_no_url(self):
        with patch.dict(os.environ, {"MCP_SERVER_URL": ""}, clear=False):
            result = get_mcp_tools()
        assert result is None

    def test_get_mcp_tools_returns_none_when_url_not_set(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("MCP_SERVER_URL", None)
        result = get_mcp_tools()
        assert result is None
