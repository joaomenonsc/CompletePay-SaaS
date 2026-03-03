"""Rota /health para verificacao de servicos."""
from fastapi import APIRouter

from src.db.session import _get_engine
from src.health import run_health_checks

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    """
    Health check: PostgreSQL e Redis.
    Retorna 200 com detalhes dos servicos.
    """
    ok, details = run_health_checks()
    status = "ok" if ok else "degraded"
    return {"status": status, "services": details}


@router.get("/health/db-pool")
def db_pool_status() -> dict:
    """Retorna estado atual do connection pool — para monitoramento (Onda 1.2)."""
    engine = _get_engine()
    pool = engine.pool
    return {
        "pool_size": pool.size(),
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
    }
