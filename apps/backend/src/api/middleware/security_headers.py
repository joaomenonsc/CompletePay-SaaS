"""Security hardening: HTTPS enforced em producao e headers de seguranca. Fase 3.3."""
import logging
from typing import cast

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from src.config.settings import get_settings

logger = logging.getLogger("completepay.api")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Em producao: rejeita requests HTTP (forca HTTPS) e adiciona headers de seguranca.
    Em desenvolvimento: apenas adiciona headers nao restritivos.
    """

    def __init__(self, app, enforce_https: bool | None = None):
        super().__init__(app)
        if enforce_https is not None:
            self.enforce_https = enforce_https
        else:
            self.enforce_https = get_settings().app_env == "production"

    async def dispatch(self, request: Request, call_next) -> Response:
        if self.enforce_https:
            proto = request.headers.get("x-forwarded-proto", "").strip().lower()
            if proto == "http":
                return cast(
                    Response,
                    JSONResponse(
                        status_code=426,
                        content={"detail": "HTTPS required"},
                        headers={"Upgrade": "TLS", "Connection": "Upgrade"},
                    ),
                )

        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        if self.enforce_https:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )
            # SBP-016: Content-Security-Policy em produção
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self' https://fonts.gstatic.com; "
                "connect-src 'self'; "
                "frame-ancestors 'none'"
            )

        return cast(Response, response)
