"""
Sessao SQLAlchemy para CRUD de agent_configs.
Usa a mesma DATABASE_URL do projeto.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from src.config.settings import get_settings

url = get_settings().database_url
engine = create_engine(url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependencia FastAPI: fornece uma sessao e fecha ao final."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
