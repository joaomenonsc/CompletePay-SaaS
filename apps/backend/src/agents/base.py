"""
Factory de agentes (Seção 6.3) e prompt de sistema base.
Memória em 3 camadas (Seção 2.3): Sessão, Usuário, Conhecimento.
"""
from typing import Any

from agno.agent import Agent

from src.config.database import get_db
from src.config.models import ModelStrategy, get_model

# Instrucoes globais: persona, idioma, regras de conduta
BASE_INSTRUCTIONS = [
    "Voce e o assistente virtual da CompletePay. Nao se apresente como modelo de linguagem, IA generica ou produto de outro fornecedor.",
    "A empresa em que voce atua e a CompletePay. Em perguntas sobre 'em qual empresa trabalha', 'quem e seu empregador' ou similar, responda sempre CompletePay.",
    "Sempre responda em portugues.",
    "Priorize seguranca e conformidade em operacoes financeiras.",
    "Se nao tiver certeza, peça confirmacao ao usuario.",
]


def create_agent(
    name: str,
    role: str,
    tools: list[Any] | None = None,
    instructions: list[str] | None = None,
    model_strategy: ModelStrategy = ModelStrategy.QUALITY,
    learning: bool = True,
    *,
    add_history_to_context: bool = True,
    num_history_runs: int = 5,
    update_memory_on_run: bool = True,
    user_id: str | None = None,
    session_id: str | None = None,
    knowledge: Any = None,
    search_knowledge: bool = False,
    pre_hooks: list[Any] | None = None,
    post_hooks: list[Any] | None = None,
) -> Agent:
    """
    Factory para criar agentes com configuracao padrao (Seção 6.3).

    Memoria em 3 camadas (Seção 2.3):
    - Layer 1 (Sessao): historico da conversa via add_history_to_context e num_history_runs.
    - Layer 2 (Usuario): fatos aprendidos por user_id via update_memory_on_run=True.
    - Layer 3 (Conhecimento): padroes globais via learning=True.

    Nao use enable_agentic_memory junto com update_memory_on_run (sao mutuamente exclusivos).

    knowledge: base de conhecimento (RAG). Se passada, use search_knowledge=True para Agentic RAG.
    pre_hooks: lista de callables para validacao de entrada (ex.: input_guardrail_chain).
    post_hooks: lista de callables para sanitizacao de saida (ex.: output_guardrail_pii).
    """
    extra = instructions or []
    all_instructions = [*BASE_INSTRUCTIONS, role, *extra]
    agent_kw: dict[str, Any] = {
        "name": name,
        "role": role,
        "model": get_model(model_strategy),
        "db": get_db(),
        "tools": tools or [],
        "instructions": all_instructions,
        "add_history_to_context": add_history_to_context,
        "num_history_runs": num_history_runs,
        "update_memory_on_run": update_memory_on_run,
        "learning": learning,
        "markdown": True,
        "user_id": user_id,
        "session_id": session_id,
    }
    if knowledge is not None:
        agent_kw["knowledge"] = knowledge
        agent_kw["search_knowledge"] = search_knowledge
    if pre_hooks:
        agent_kw["pre_hooks"] = pre_hooks
    if post_hooks:
        agent_kw["post_hooks"] = post_hooks
    return Agent(**agent_kw)
