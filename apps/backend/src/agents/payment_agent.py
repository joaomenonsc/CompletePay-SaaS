"""Payment Specialist - foco em transacoes (Fase 5)."""
from agno.agent import Agent

from src.agents.base import create_agent
from src.config.models import ModelStrategy
from src.tools import PAYMENT_TOOLS


def get_payment_agent() -> Agent:
    """Retorna o agente especialista em pagamentos."""
    return create_agent(
        name="Payment Specialist",
        role="Processa e consulta operacoes de pagamento. Especialista em transacoes do CompletePay.",
        tools=PAYMENT_TOOLS,
        instructions=["Use as tools para processar pagamentos, estornos e consultar status."],
        model_strategy=ModelStrategy.GEMINI_FAST,
        learning=False,
    )
