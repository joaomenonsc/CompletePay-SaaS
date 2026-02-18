"""Fraud Analyst - foco em seguranca e analise (Fase 5)."""
from agno.agent import Agent

from src.agents.base import create_agent
from src.config.models import ModelStrategy
from src.tools import COMPLIANCE_TOOLS


def get_fraud_agent() -> Agent:
    """Retorna o agente analista de fraude."""
    return create_agent(
        name="Fraud Analyst",
        role="Analisa e detecta transacoes suspeitas. Priorize seguranca e conformidade.",
        tools=COMPLIANCE_TOOLS,
        instructions=[
            "Use verify_identity e audit_log quando relevante.",
            "Em analise de disputa, conclua com 'fraude confirmada' apenas se houver indicios claros; caso contrario nao use essa frase.",
        ],
        model_strategy=ModelStrategy.GEMINI_FAST,
        learning=False,
    )
