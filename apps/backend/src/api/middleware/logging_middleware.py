"""Middleware de logging de requisicoes (suporta logs estruturados)."""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("completepay.api")


class LoggingMiddleware(BaseHTTPMiddleware):
    """Registra metodo, path, status e duracao de cada requisicao."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        # Log estruturado: campos extras sao serializados em JSON quando usar StructuredFormatter
        logger.info(
            "%s %s %s %.2fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            },
        )
        return response
