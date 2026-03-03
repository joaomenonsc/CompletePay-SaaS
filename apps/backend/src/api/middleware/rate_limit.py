"""Rate limiting por usuario (autenticado) ou por IP (anonimo).

Onda 1.4 — Migrado de dict in-memory para Redis, garantindo rate limit
consistente entre múltiplas instâncias e persistente entre restarts.
Fallback para in-memory se Redis não estiver disponível.
"""
import logging
import time
from collections import defaultdict

import redis

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.config.settings import get_settings

logger = logging.getLogger("completepay.ratelimit")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Limita requisicoes por minuto.
    Se o usuario estiver autenticado (request.state.user_id), usa limite por usuario.
    Senao, usa limite por IP (evita abuso de rotas publicas).
    Usa Redis como backend (Onda 1.4); fallback para in-memory se Redis indisponível.
    """

    def __init__(self, app, requests_per_minute: int | None = None):
        super().__init__(app)
        settings = get_settings()
        self.limit = requests_per_minute or settings.api_rate_limit
        self.period = 60  # 1 minuto

        # Redis como backend principal
        self._redis: redis.Redis | None = None
        try:
            self._redis = redis.from_url(settings.redis_url, decode_responses=True)
            self._redis.ping()
            logger.info("RateLimit: usando Redis como backend.")
        except Exception:
            logger.warning("RateLimit: Redis indisponível — fallback para in-memory.")
            self._redis = None

        # Fallback in-memory
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
            return f"rl:user:{user_id}"
        return f"rl:ip:{self._get_client_key(request)}"

    async def dispatch(self, request: Request, call_next):
        key = self._get_rate_limit_key(request)

        # Tentar Redis primeiro
        if self._redis is not None:
            try:
                count = self._redis.incr(key)
                if count == 1:
                    self._redis.expire(key, self.period)
                if count > self.limit:
                    return JSONResponse(
                        content={"detail": "Rate limit exceeded"},
                        status_code=429,
                        headers={"Retry-After": str(self.period)},
                    )
                return await call_next(request)
            except redis.RedisError:
                logger.warning("RateLimit: erro no Redis — fallback para in-memory.")

        # Fallback in-memory (janela deslizante)
        now = time.time()
        window_start = now - self.period
        self._requests[key] = [t for t in self._requests[key] if t > window_start]
        if len(self._requests[key]) >= self.limit:
            return JSONResponse(
                content={"detail": "Rate limit exceeded"},
                status_code=429,
                headers={"Retry-After": str(self.period)},
            )
        self._requests[key].append(now)
        return await call_next(request)
