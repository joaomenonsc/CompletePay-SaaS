"""Rota /health para verificacao de servicos."""
from fastapi import APIRouter

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
