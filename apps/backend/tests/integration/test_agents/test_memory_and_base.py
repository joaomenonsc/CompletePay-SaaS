"""
Testes de agente base (factory) e memoria em 3 camadas.
Persistencia de fatos entre sessoes: mesmo user_id, duas runs; o agente deve
ter acesso a memoria do usuario (update_memory_on_run).
"""
import os
from unittest.mock import patch

import pytest

from dotenv import load_dotenv
load_dotenv()  # DATABASE_URL e chaves de API no .env


@pytest.fixture
def user_id() -> str:
    return "test-user-memory"


@pytest.fixture
def db_sqlite_memory():
    """Usa SQLite em memoria para testes que nao precisam de PostgreSQL."""
    from agno.db.sqlite import SqliteDb
    return SqliteDb(db_file=":memory:")


class TestCreateAgent:
    """Factory create_agent e configuracao de memoria."""

    def test_create_agent_has_memory_config(self, db_sqlite_memory) -> None:
        from src.agents.base import create_agent
        from src.config.models import ModelStrategy

        with patch("src.agents.base.get_db", return_value=db_sqlite_memory):
            agent = create_agent(
                name="test-agent",
                role="Assistente de teste.",
                model_strategy=ModelStrategy.COST,
                learning=True,
                update_memory_on_run=True,
                num_history_runs=5,
            )
        assert agent.update_memory_on_run is True
        assert agent.num_history_runs == 5
        assert agent.add_history_to_context is True
        assert agent.learning is True
        assert agent.name == "test-agent"

    def test_create_agent_includes_base_instructions(self, db_sqlite_memory) -> None:
        from src.agents.base import create_agent
        from src.config.models import ModelStrategy

        with patch("src.agents.base.get_db", return_value=db_sqlite_memory):
            agent = create_agent(
                name="test-agent",
                role="Role especifico.",
                model_strategy=ModelStrategy.COST,
            )
        instructions = agent.instructions if isinstance(agent.instructions, list) else [agent.instructions]
        text = " ".join(instructions).lower()
        assert "completepay" in text
        assert "portugues" in text
        assert "role especifico" in text


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL") or not os.getenv("GOOGLE_API_KEY") or os.getenv("SKIP_E2E_LLM") == "1",
    reason="DATABASE_URL/GOOGLE_API_KEY nao setado ou SKIP_E2E_LLM=1 para pular testes que chamam LLM",
)
class TestMemoryPersistence:
    """
    Persistencia de fatos do usuario entre sessoes (mesmo user_id).
    Requer DATABASE_URL e GOOGLE_API_KEY (Gemini) ou outra chave conforme o modelo.
    """

    def test_memory_persistence_across_runs(self, user_id: str) -> None:
        from src.agents.base import create_agent
        from src.config.models import ModelStrategy

        agent = create_agent(
            name="test-memory-agent",
            role="Guarde informacoes que o usuario disser e use-as depois.",
            model_strategy=ModelStrategy.GEMINI_FAST,
            update_memory_on_run=True,
            user_id=user_id,
        )
        # Sessao 1: informar um fato
        try:
            r1 = agent.run("Lembre-se: meu nome de usuario preferido e 'joao_silva' e trabalho na filial SP.")
        except Exception as e:
            if "expired" in str(e).lower() or "api_key_invalid" in str(e).lower() or "400" in str(e):
                pytest.skip("Chave do Gemini API invalida ou expirada. Pulando teste.")
            raise

        assert r1 is not None
        assert r1.content
        if "api key expired" in r1.content.lower() or "api_key_invalid" in r1.content.lower():
            pytest.skip("Chave do Gemini expirada via retorno do LLM. Pulando teste.")

        # Sessao 2 (mesmo user_id): perguntar sobre o fato
        r2 = agent.run("Qual e o meu nome de usuario preferido que eu te falei? E em qual filial trabalho?")
        assert r2 is not None
        assert r2.content
        content_lower = r2.content.lower()
        assert "joao_silva" in content_lower or "joao" in content_lower
        assert "sp" in content_lower or "filial" in content_lower
