"""
Sessao SQLAlchemy para CRUD de agent_configs.
Usa a mesma DATABASE_URL do projeto.
Engine criado sob demanda (lazy) para o app subir mesmo sem DB acessível (ex.: cold start na Vercel).
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from src.config.settings import get_settings

Base = declarative_base()

_engine = None
_SessionLocal = None


def _get_engine():
    """Cria o engine na primeira uso (lazy)."""
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_size=20,          # conexões sempre abertas
            max_overflow=10,       # pico: até 30 total
            pool_timeout=30,       # espera 30s antes de levantar erro
            pool_recycle=1800,     # reconecta a cada 30min (evita stale)
            echo=settings.app_env == "development",
        )
    return _engine


def _get_session_factory():
    """Cria o sessionmaker na primeira uso (lazy)."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=_get_engine()
        )
    return _SessionLocal


class _LazyEngine:
    """Proxy: delega para o engine real na primeira utilização."""

    def __getattr__(self, name):
        return getattr(_get_engine(), name)


class _LazySessionLocal:
    """Proxy: na primeira chamada obtém o sessionmaker e devolve uma sessão."""

    def __call__(self) -> Session:
        return _get_session_factory()()


engine = _LazyEngine()
SessionLocal = _LazySessionLocal()


def get_db() -> Generator[Session, None, None]:
    """Dependencia FastAPI: fornece uma sessao e fecha ao final."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
