"""Support Specialist - foco em FAQ e atendimento (Fase 5)."""
from agno.agent import Agent

from src.agents.base import create_agent
from src.config.models import ModelStrategy
from src.tools import SUPPORT_TOOLS


def get_support_agent() -> Agent:
    """Retorna o agente especialista em suporte ao cliente."""
    return create_agent(
        name="Support Specialist",
        role="Atende duvidas e problemas dos clientes. Especialista em suporte CompletePay.",
        tools=SUPPORT_TOOLS,
        instructions=["Use as tools para criar tickets e consultar FAQ. Seja cordial e objetivo."],
        model_strategy=ModelStrategy.GEMINI_FAST,
        learning=False,
    )
