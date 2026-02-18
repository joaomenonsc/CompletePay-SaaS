"""
Teste E2E da Fase 4: pergunta ao agente com RAG (base ja populada).
Pulado sem DATABASE_URL e GOOGLE_API_KEY (ou com SKIP_E2E_LLM=1).
Rode scripts/seed_knowledge.py antes para popular a base.
"""
import os

import pytest

from dotenv import load_dotenv
load_dotenv()


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL") or not os.getenv("GOOGLE_API_KEY") or os.getenv("SKIP_E2E_LLM") == "1",
    reason="Requer DATABASE_URL, GOOGLE_API_KEY e sem SKIP_E2E_LLM para rodar E2E RAG",
)
class TestRAGE2E:
    """Teste de ponta a ponta: agente com RAG responde com base nos documentos."""

    def test_ask_about_ted_prazo(self):
        from src.knowledge.setup import KNOWLEDGE_TABLE_NAME, get_knowledge
        from src.agents.base import create_agent
        from src.config.models import ModelStrategy
        from src.tools import get_all_tools

        knowledge = get_knowledge(table_name=KNOWLEDGE_TABLE_NAME)
        agent = create_agent(
            name="e2e-rag-agent",
            role="Responda com base nos documentos da base de conhecimento CompletePay.",
            tools=get_all_tools(include_mcp=False),
            model_strategy=ModelStrategy.GEMINI_FAST,
            knowledge=knowledge,
            search_knowledge=True,
        )
        response = agent.run("Qual o prazo de uma transferencia TED?")
        assert response is not None
        assert response.content
        content_lower = response.content.lower()
        assert "ted" in content_lower or "transferencia" in content_lower or "dia" in content_lower or "prazo" in content_lower
