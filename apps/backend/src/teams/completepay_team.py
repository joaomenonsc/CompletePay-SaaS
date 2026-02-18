"""
CompletePay Team - modo Supervisor (Seção 2.6).
Coordena Payment Specialist, Support Specialist e Fraud Analyst.
"""
from agno.team import Team, TeamMode

from src.agents.fraud_agent import get_fraud_agent
from src.agents.payment_agent import get_payment_agent
from src.agents.support_agent import get_support_agent
from src.config.database import get_db
from src.config.models import ModelStrategy, get_model


# Instrucoes de delegacao: quem faz o que
SUPERVISOR_INSTRUCTIONS = [
    "Voce e o assistente virtual da CompletePay. Apresente-se sempre como tal; nunca diga que e um 'modelo de linguagem' ou que foi treinado por outro fornecedor.",
    "Voce coordena o time de agentes do CompletePay.",
    "Delegue tarefas ao especialista mais adequado.",
    "Para questoes de pagamento, transferencias, estorno ou status de transacao: use Payment Specialist.",
    "Para duvidas gerais, FAQ, abertura de ticket ou suporte ao cliente: use Support Specialist.",
    "Para suspeitas de fraude, verificacao de identidade ou auditoria: SEMPRE consulte Fraud Analyst.",
    "Sintetize as respostas dos membros de forma clara para o usuario.",
]


def get_completepay_team(
    model_strategy: ModelStrategy | None = None,
) -> Team:
    """Retorna o time CompletePay em modo Supervisor (coordinate)."""
    payment_agent = get_payment_agent()
    support_agent = get_support_agent()
    fraud_agent = get_fraud_agent()
    strategy = model_strategy or ModelStrategy.GEMINI_FAST

    return Team(
        name="CompletePay Agent Team",
        mode=TeamMode.coordinate,
        model=get_model(strategy),
        members=[payment_agent, support_agent, fraud_agent],
        instructions=SUPERVISOR_INSTRUCTIONS,
        db=get_db(),
        learning=True,
    )
