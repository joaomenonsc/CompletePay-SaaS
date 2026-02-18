"""
Ferramentas customizadas (Fase 3).
Exporta tools por categoria e helper para lista completa (incluindo MCP opcional).
"""
from src.tools.account_tools import check_balance, get_transactions
from src.tools.compliance_tools import audit_log, verify_identity
from src.tools.payment_tools import check_status, process_payment, refund_payment
from src.tools.support_tools import create_ticket, get_faq

# Tools por categoria (para montar agentes especializados)
PAYMENT_TOOLS = [process_payment, refund_payment, check_status]
ACCOUNT_TOOLS = [check_balance, get_transactions]
SUPPORT_TOOLS = [create_ticket, get_faq]
COMPLIANCE_TOOLS = [verify_identity, audit_log]

# Todas as tools customizadas (sem MCP)
ALL_CUSTOM_TOOLS = PAYMENT_TOOLS + ACCOUNT_TOOLS + SUPPORT_TOOLS + COMPLIANCE_TOOLS


def get_all_tools(include_mcp: bool = True) -> list:
    """
    Retorna lista de tools para o agente: customizadas + opcionalmente MCP.
    MCP e incluido apenas se MCP_SERVER_URL estiver configurada.
    """
    from src.tools.mcp_integration import get_mcp_tools
    tools = list(ALL_CUSTOM_TOOLS)
    if include_mcp:
        mcp = get_mcp_tools()
        if mcp is not None:
            tools.append(mcp)
    return tools


__all__ = [
    "PAYMENT_TOOLS",
    "ACCOUNT_TOOLS",
    "SUPPORT_TOOLS",
    "COMPLIANCE_TOOLS",
    "ALL_CUSTOM_TOOLS",
    "get_all_tools",
    "process_payment",
    "refund_payment",
    "check_status",
    "check_balance",
    "get_transactions",
    "create_ticket",
    "get_faq",
    "verify_identity",
    "audit_log",
]
