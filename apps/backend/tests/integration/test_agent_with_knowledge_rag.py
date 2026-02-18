"""Testes do agente com RAG (knowledge + search_knowledge) - Fase 4."""
from unittest.mock import MagicMock, patch

import pytest

from src.agents.base import create_agent
from src.config.models import ModelStrategy


@pytest.fixture
def db_sqlite_memory():
    from agno.db.sqlite import SqliteDb
    return SqliteDb(db_file=":memory:")


@pytest.fixture
def mock_knowledge():
    """Objeto que imita a base de conhecimento para testes."""
    return MagicMock(name="completepay_knowledge")


class TestCreateAgentWithKnowledge:
    def test_agent_accepts_knowledge_and_search_knowledge(self, db_sqlite_memory, mock_knowledge):
        with patch("src.agents.base.get_db", return_value=db_sqlite_memory):
            agent = create_agent(
                name="test-rag-agent",
                role="Assistente com base de conhecimento.",
                model_strategy=ModelStrategy.COST,
                knowledge=mock_knowledge,
                search_knowledge=True,
            )
        assert agent.knowledge is mock_knowledge
        assert agent.search_knowledge is True

    def test_agent_without_knowledge_has_no_knowledge(self, db_sqlite_memory):
        with patch("src.agents.base.get_db", return_value=db_sqlite_memory):
            agent = create_agent(
                name="test-no-rag",
                role="Assistente.",
                model_strategy=ModelStrategy.COST,
            )
        assert getattr(agent, "knowledge", None) is None or agent.knowledge is None
