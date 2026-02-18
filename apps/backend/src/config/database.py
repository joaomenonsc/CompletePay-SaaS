"""
Configuracao de banco de dados.
- Desenvolvimento: PostgresDb (sincrono).
- Producao: AsyncPostgresDb (assincrono).
"""
import os
from typing import Union

from agno.db.postgres import AsyncPostgresDb, PostgresDb

from src.config.settings import get_settings


def get_db_sync() -> PostgresDb:
    """Conexao sincrona para desenvolvimento e scripts."""
    url = os.getenv("DATABASE_URL") or get_settings().database_url
    return PostgresDb(db_url=url)


def get_db_async() -> AsyncPostgresDb:
    """Conexao assincrona para producao (FastAPI/AgentOS)."""
    url = os.getenv("DATABASE_URL") or get_settings().database_url
    if not url.startswith("postgresql+psycopg_async://"):
        url = url.replace("postgresql://", "postgresql+psycopg_async://", 1)
    return AsyncPostgresDb(db_url=url)


def get_db(use_async: bool = False) -> Union[PostgresDb, AsyncPostgresDb]:
    """Retorna PostgresDb (sync) ou AsyncPostgresDb conforme ambiente."""
    if use_async or os.getenv("APP_ENV") == "production":
        return get_db_async()
    return get_db_sync()
