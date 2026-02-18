"""
Integracao MCP (Model Context Protocol) - Seção 5.3.
Retorna MCPTools configurado para conexao com servidor externo quando MCP_SERVER_URL esta definida.
"""
from typing import Any

from src.config.settings import get_settings


def get_mcp_tools() -> Any | None:
    """
    Retorna MCPTools conectado ao servidor MCP externo se MCP_SERVER_URL estiver configurada.
    Caso contrario retorna None (nao adiciona tools MCP).
    """
    import os
    url = os.getenv("MCP_SERVER_URL") or get_settings().mcp_server_url
    if not url:
        return None
    try:
        from agno.tools.mcp import MCPTools
        return MCPTools(url=url)
    except ImportError:
        return None
