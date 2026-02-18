"""
Configuracao de modelos LLM: Strategy Pattern (Seção 6.2) e Circuit Breaker (Seção 6.6).
Claude Sonnet 4.5 = primario. GPT-4.1-mini = fallback. Google Gemini disponivel.
"""
from enum import Enum
from typing import Any

from agno.models.anthropic import Claude
from agno.models.google import Gemini
from agno.models.openai import OpenAIChat


class ModelStrategy(str, Enum):
    """Estrategia de selecao de modelo."""

    QUALITY = "quality"    # Claude Sonnet 4.5 - conversacao e analise complexa
    SPEED = "speed"        # Claude Haiku 3.5 - baixa latencia
    COST = "cost"          # GPT-4.1-mini - menor custo
    FALLBACK = "fallback"   # Provider alternativo (redundancia)
    GEMINI_FAST = "gemini_fast"   # Gemini 2.0 Flash - rapido e versatil
    GEMINI_PRO = "gemini_pro"     # Gemini 1.5 Pro - alta capacidade


# Mapeamento: Anthropic, OpenAI e Google (Gemini)
_MODELS = {
    ModelStrategy.QUALITY: Claude(id="claude-sonnet-4-5"),
    ModelStrategy.SPEED: Claude(id="claude-haiku-3-5"),
    ModelStrategy.COST: OpenAIChat(id="gpt-4.1-mini"),
    ModelStrategy.FALLBACK: OpenAIChat(id="gpt-4.1"),
    ModelStrategy.GEMINI_FAST: Gemini(id="gemini-2.0-flash"),
    ModelStrategy.GEMINI_PRO: Gemini(id="gemini-1.5-pro"),
}

PRIMARY_MODEL = _MODELS[ModelStrategy.QUALITY]
FALLBACK_MODEL = _MODELS[ModelStrategy.FALLBACK]


def get_model(strategy: ModelStrategy = ModelStrategy.QUALITY):
    """Retorna o modelo conforme a estrategia (Strategy Pattern - Seção 6.2)."""
    return _MODELS[strategy]


class ModelCircuitBreaker:
    """
    Circuit breaker para fallback de provider LLM (Seção 6.6).
    Usa modelo primario ate atingir failure_threshold; depois usa fallback.
    """

    def __init__(
        self,
        primary_model: Any = None,
        fallback_model: Any = None,
        failure_threshold: int = 3,
    ):
        self.primary = primary_model or PRIMARY_MODEL
        self.fallback = fallback_model or FALLBACK_MODEL
        self.failures = 0
        self.threshold = failure_threshold
        self.state = "closed"  # closed | open | half-open

    def _reset_on_success(self) -> None:
        self.failures = 0
        if self.state == "half-open":
            self.state = "closed"

    def _record_failure(self) -> None:
        self.failures += 1
        if self.failures >= self.threshold:
            self.state = "open"

    def get_model(self):
        """Retorna o modelo a usar no momento (primario ou fallback)."""
        if self.state == "open":
            return self.fallback
        return self.primary

    def record_success(self) -> None:
        """Chamar apos uma chamada bem-sucedida ao modelo."""
        self._reset_on_success()

    def record_failure(self) -> None:
        """Chamar apos falha; acima do threshold passa a usar fallback."""
        self._record_failure()
        if self.failures >= self.threshold:
            self.state = "open"


def get_model_with_circuit_breaker(
    failure_threshold: int = 3,
) -> tuple[Any, ModelCircuitBreaker]:
    """
    Retorna (modelo atual, circuit_breaker).
    O caller deve chamar circuit_breaker.record_success() ou record_failure()
    apos cada chamada ao LLM; get_model() do breaker indica qual modelo usar.
    """
    breaker = ModelCircuitBreaker(
        primary_model=PRIMARY_MODEL,
        fallback_model=FALLBACK_MODEL,
        failure_threshold=failure_threshold,
    )
    return breaker.get_model(), breaker
