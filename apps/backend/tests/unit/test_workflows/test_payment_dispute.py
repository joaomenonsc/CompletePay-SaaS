"""Testes do PaymentDisputeWorkflow - branches condicionais (Fase 5)."""
from agno.workflow import Condition
from agno.workflow.types import StepInput, StepOutput

from src.workflows.payment_dispute import _fraude_confirmada


def _make_step_input(previous_content: str | None) -> StepInput:
    """Cria StepInput com previous_step_outputs simulando um step anterior."""
    step_input = StepInput(input="dispute-123")
    if previous_content is not None:
        out = StepOutput(content=previous_content, step_name="fraud_analysis")
        step_input.previous_step_outputs = {"fraud_analysis": out}
    else:
        step_input.previous_step_outputs = {}
    return step_input


class TestFraudeConfirmada:
    """Testa o evaluator do branch (fraude confirmada ou nao)."""

    def test_returns_true_when_fraude_confirmada_in_content(self):
        step_input = _make_step_input("Apos analise, fraude confirmada. Recomendo bloqueio.")
        assert _fraude_confirmada(step_input) is True

    def test_returns_true_case_insensitive(self):
        step_input = _make_step_input("FRAUDE CONFIRMADA pelo sistema.")
        assert _fraude_confirmada(step_input) is True

    def test_returns_false_when_fraude_not_confirmed(self):
        step_input = _make_step_input("Nao ha indicios suficientes de fraude. Encaminhar para suporte.")
        assert _fraude_confirmada(step_input) is False

    def test_returns_false_when_no_previous_content(self):
        step_input = _make_step_input(None)
        assert _fraude_confirmada(step_input) is False

    def test_returns_false_when_empty_content(self):
        step_input = _make_step_input("")
        assert _fraude_confirmada(step_input) is False


class TestPaymentDisputeWorkflowStructure:
    """Valida a estrutura do workflow (steps e condition)."""

    def test_workflow_has_steps(self):
        from src.workflows.payment_dispute import get_payment_dispute_workflow
        w = get_payment_dispute_workflow()
        assert w.steps is not None
        assert hasattr(w.steps, "steps")
        assert len(w.steps.steps) >= 2

    def test_workflow_first_step_is_fraud(self):
        from src.workflows.payment_dispute import get_payment_dispute_workflow
        w = get_payment_dispute_workflow()
        first = w.steps.steps[0]
        assert getattr(first, "name", None) == "fraud_analysis"

    def test_workflow_second_step_is_condition(self):
        from src.workflows.payment_dispute import get_payment_dispute_workflow
        w = get_payment_dispute_workflow()
        second = w.steps.steps[1]
        assert isinstance(second, Condition)
        assert getattr(second, "else_steps", None) is not None
