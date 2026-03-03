"""Correlation ID middleware (Onda 0.3 — Performance & Confiabilidade).

Gera ou propaga um X-Request-ID para cada request, permitindo rastrear
logs entre frontend → backend → banco em um único trace.

Uso direto em qualquer parte do código:
    from src.api.middleware.correlation_middleware import get_request_id
    request_id = get_request_id()
"""
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_request_id: ContextVar[str] = ContextVar("request_id", default="")


def get_request_id() -> str:
    """Retorna o request ID do contexto atual (vazio se fora de um request)."""
    return _request_id.get()


class CorrelationMiddleware(BaseHTTPMiddleware):
    """Injeta X-Request-ID em cada request/response."""

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        _request_id.set(req_id)
        response = await call_next(request)
        response.headers["X-Request-ID"] = req_id
        return response
