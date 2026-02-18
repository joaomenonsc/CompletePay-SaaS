"""
Workflow para processar disputas de pagamento (Seção 2.7).
Logica deterministica: analise de fraude -> branch -> refund ou ticket de suporte.
"""
from agno.workflow import Condition, Step, Steps, Workflow
from agno.workflow.types import StepInput, StepOutput

from src.agents.fraud_agent import get_fraud_agent
from src.agents.payment_agent import get_payment_agent
from src.agents.support_agent import get_support_agent
from src.config.database import get_db


def _fraude_confirmada(step_input: StepInput) -> bool:
    """Avalia se a analise de fraude indicou fraude confirmada."""
    content = step_input.get_last_step_content() or ""
    return "fraude confirmada" in str(content).lower()


def _step_fraud_analysis(step_input: StepInput) -> StepOutput:
    """Step 1: analise de fraude."""
    dispute_id = step_input.get_input_as_string() or step_input.input or "unknown"
    agent = get_fraud_agent()
    result = agent.run(
        f"Analise a transacao/disputa {dispute_id} para indicios de fraude. "
        "Responda de forma objetiva. Se houver fraude confirmada, inclua a frase 'fraude confirmada' na resposta."
    )
    return StepOutput(content=result.content)


def _step_refund(step_input: StepInput) -> StepOutput:
    """Branch fraude: processar estorno."""
    dispute_id = step_input.get_input_as_string() or step_input.input or "unknown"
    agent = get_payment_agent()
    result = agent.run(f"Processe estorno para a disputa {dispute_id}.")
    return StepOutput(content=result.content)


def _step_ticket(step_input: StepInput) -> StepOutput:
    """Branch sem fraude: criar ticket de suporte."""
    dispute_id = step_input.get_input_as_string() or step_input.input or "unknown"
    agent = get_support_agent()
    result = agent.run(
        f"Crie um ticket de suporte para a disputa {dispute_id}. "
        "Assunto: disputa de pagamento para analise humana."
    )
    return StepOutput(content=result.content)


def get_payment_dispute_workflow() -> Workflow:
    """Retorna o workflow de disputa de pagamento."""
    return Workflow(
        name="Payment Dispute Workflow",
        description="Analise de fraude e encaminhamento: refund ou ticket.",
        db=get_db(),
        steps=Steps(
            name="dispute_pipeline",
            description="Analise fraude -> refund ou suporte",
            steps=[
                Step(
                    name="fraud_analysis",
                    description="Analise da transacao para indicios de fraude",
                    executor=_step_fraud_analysis,
                ),
                Condition(
                    name="branch_fraude",
                    description="Se fraude confirmada, estorno; senao ticket",
                    evaluator=_fraude_confirmada,
                    steps=[
                        Step(
                            name="refund",
                            description="Processar estorno",
                            executor=_step_refund,
                        ),
                    ],
                    else_steps=[
                        Step(
                            name="ticket",
                            description="Criar ticket para suporte humano",
                            executor=_step_ticket,
                        ),
                    ],
                ),
            ],
        ),
    )
