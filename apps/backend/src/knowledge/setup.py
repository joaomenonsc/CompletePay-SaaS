"""
Configuracao da base de conhecimento (RAG) - Fase 4, Seção 2.4.
PgVector como Vector Store com busca hibrida (keyword + semantica).
TextKnowledgeBase: use knowledge.insert(path="...") para .md/.txt.
PDF/URL: use knowledge.insert(url="...") para PDFs ou paginas web.
"""
import os
from pathlib import Path
from typing import Optional

from agno.knowledge import Knowledge
from agno.knowledge.embedder.google import GeminiEmbedder
from agno.vectordb.pgvector import PgVector
from agno.vectordb.search import SearchType

from src.config.settings import get_settings

# Nome da tabela no PostgreSQL (schema ai)
KNOWLEDGE_TABLE_NAME = "completepay_knowledge"

# Diretorio de documentos fonte (relativo ao projeto)
SOURCES_DIR = Path(__file__).resolve().parent / "sources"


def get_embedder():
    """Embedder para vetorizacao (Google Gemini). Usa GOOGLE_API_KEY."""
    return GeminiEmbedder(id="gemini-embedding-001", dimensions=1536)


def get_vector_db(
    table_name: str = KNOWLEDGE_TABLE_NAME,
    db_url: Optional[str] = None,
    search_type: SearchType = SearchType.hybrid,
) -> PgVector:
    """
    Retorna PgVector configurado com busca hibrida (keyword + semantica).
    """
    url = db_url or os.getenv("DATABASE_URL") or get_settings().database_url
    return PgVector(
        table_name=table_name,
        db_url=url,
        embedder=get_embedder(),
        search_type=search_type,
        vector_score_weight=0.5,
        content_language="portuguese",
    )


def get_knowledge(
    table_name: str = KNOWLEDGE_TABLE_NAME,
    max_results: int = 10,
) -> Knowledge:
    """
    Retorna a base de conhecimento CompletePay (RAG).
    Usa PgVector com busca hibrida. Popule com scripts/seed_knowledge.py.
    """
    vector_db = get_vector_db(table_name=table_name)
    return Knowledge(
        name="completepay_knowledge",
        description="Politicas, FAQ e procedimentos CompletePay",
        vector_db=vector_db,
        max_results=max_results,
    )
