"""Rate limiting por usuario (autenticado) ou por IP (anonimo). Fase 3.3."""
import time
from collections import defaultdict

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from src.config.settings import get_settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Limita requisicoes por minuto.
    Se o usuario estiver autenticado (request.state.user_id), usa limite por usuario.
    Senao, usa limite por IP (evita abuso de rotas publicas).
    Janela deslizante de 1 minuto (in-memory).
    """

    def __init__(self, app, requests_per_minute: int | None = None):
        super().__init__(app)
        self.limit = requests_per_minute or get_settings().api_rate_limit
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _get_client_key(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _get_rate_limit_key(self, request: Request) -> str:
        """Chave do rate limit: por usuario quando autenticado, senao por IP."""
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"
        return f"ip:{self._get_client_key(request)}"

    async def dispatch(self, request: Request, call_next):
        key = self._get_rate_limit_key(request)
        now = time.time()
        window_start = now - 60
        self._requests[key] = [t for t in self._requests[key] if t > window_start]
        if len(self._requests[key]) >= self.limit:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        self._requests[key].append(now)
        return await call_next(request)
