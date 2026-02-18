"""
Schemas de entrada e saída estruturadas para o Assistente de Saúde.

Baseado em https://docs.agno.com/input-output/overview
- Entrada estruturada: valida e tipa o input (Pydantic).
- Saída estruturada: resposta como objeto validado em vez de texto livre.
"""
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Entrada estruturada (docs.agno.com/input-output/structured-input/agent)
# ---------------------------------------------------------------------------


class PerguntaSaudeInput(BaseModel):
    """Schema de entrada para perguntas ao Assistente de Saúde."""

    pergunta: str = Field(description="Pergunta ou dúvida do usuário sobre saúde.")
    contexto_extra: Optional[str] = Field(
        default=None,
        description="Informação adicional (ex.: idade, condição de saúde) para contextualizar a resposta.",
    )
    preferir_resumo: bool = Field(
        default=False,
        description="Se True, o assistente deve priorizar uma resposta mais curta.",
    )


# ---------------------------------------------------------------------------
# Saída estruturada (docs.agno.com/input-output/structured-output/agent)
# ---------------------------------------------------------------------------


class RespostaSaudeOutput(BaseModel):
    """Schema de saída da resposta do Assistente de Saúde."""

    resumo: str = Field(description="Resposta principal, clara e objetiva.")
    pontos_principais: List[str] = Field(
        default_factory=list,
        description="Lista de pontos-chave ou recomendações gerais.",
    )
    aviso_medico: str = Field(
        default="Consulte um profissional de saúde para orientação personalizada.",
        description="Aviso padrão lembrando que a resposta é informativa e não substitui consulta.",
    )
    fora_do_escopo: bool = Field(
        default=False,
        description="True se a pergunta não for sobre saúde e o assistente recusou responder.",
    )
