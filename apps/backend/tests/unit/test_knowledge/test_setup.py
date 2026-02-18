"""Testes da configuracao da base de conhecimento (Fase 4)."""


from src.knowledge.setup import (
    KNOWLEDGE_TABLE_NAME,
    SOURCES_DIR,
    get_embedder,
    get_vector_db,
    get_knowledge,
)
from agno.knowledge.embedder.google import GeminiEmbedder
from agno.knowledge import Knowledge
from agno.vectordb.pgvector import PgVector
from agno.vectordb.search import SearchType


class TestConstants:
    def test_table_name(self):
        assert KNOWLEDGE_TABLE_NAME == "completepay_knowledge"

    def test_sources_dir_exists(self):
        assert SOURCES_DIR.is_dir()
        assert SOURCES_DIR.name == "sources"

    def test_source_docs_exist(self):
        docs = [
            "policies/payment-policies.md",
            "compliance/compliance-rules.md",
            "faq/customer-faq.md",
            "procedures/onboarding.md",
        ]
        for rel in docs:
            assert (SOURCES_DIR / rel).exists(), f"Arquivo esperado: {rel}"


class TestGetEmbedder:
    def test_returns_gemini_embedder(self):
        emb = get_embedder()
        assert isinstance(emb, GeminiEmbedder)
        assert emb.id == "gemini-embedding-001"
        assert emb.dimensions == 1536


class TestGetVectorDb:
    def test_returns_pgvector_with_hybrid_search(self):
        # URL fake; PgVector so conecta ao criar tabela (Knowledge), aqui so validamos atributos
        db = get_vector_db(
            table_name="test_table",
            db_url="postgresql://user:pass@localhost:5432/test_db",
            search_type=SearchType.hybrid,
        )
        assert isinstance(db, PgVector)
        assert db.table_name == "test_table"
        assert db.search_type == SearchType.hybrid
        assert db.vector_score_weight == 0.5
        assert db.content_language == "portuguese"
        assert db.embedder is not None
        assert isinstance(db.embedder, GeminiEmbedder)


class TestGetKnowledge:
    def test_returns_knowledge_with_vector_db(self):
        from unittest.mock import MagicMock, patch
        # get_knowledge chama get_vector_db que conecta ao Postgres; mock para nao precisar de DB
        mock_vector_db = MagicMock()
        mock_vector_db.exists.return_value = True
        with patch("src.knowledge.setup.get_vector_db", return_value=mock_vector_db):
            kb = get_knowledge(table_name="test_kb_table")
        assert isinstance(kb, Knowledge)
        assert kb.name == "completepay_knowledge"
        assert kb.vector_db is mock_vector_db
        assert kb.max_results == 10
