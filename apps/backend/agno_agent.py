"""
Ponto de entrada do agente CompletePay (Agno).
Fases 1-4: infra, core, tools, RAG. Execute migrate_db.py e seed_knowledge.py.
"""
from dotenv import load_dotenv

load_dotenv()

from src.agents.base import create_agent  # noqa: E402
from src.config.models import ModelStrategy  # noqa: E402
from src.tools import get_all_tools  # noqa: E402

# Base de conhecimento (RAG) - opcional; use seed_knowledge.py para popular
_knowledge = None
try:
    from src.knowledge.setup import get_knowledge
    _knowledge = get_knowledge()
except Exception:
    pass

agent = create_agent(
    name="completepay-agent",
    role="Voce e o agente inteligente do CompletePay. Use a base de conhecimento quando perguntarem sobre politicas, FAQ ou procedimentos.",
    tools=get_all_tools(),
    model_strategy=ModelStrategy.GEMINI_FAST,
    learning=True,
    update_memory_on_run=True,
    add_history_to_context=True,
    num_history_runs=5,
    knowledge=_knowledge,
    search_knowledge=_knowledge is not None,
)


def main() -> None:
    """Executa uma pergunta no agente (exemplo)."""
    agent.print_response("Apresente-se em uma frase.", stream=True)


if __name__ == "__main__":
    main()
