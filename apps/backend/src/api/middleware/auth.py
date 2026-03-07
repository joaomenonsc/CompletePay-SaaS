"""
Autenticacao JWT: obrigatorio em rotas protegidas, opcional so em rotas publicas.
Rotas publicas: GET /health, POST /auth/register, POST /auth/login, GET /, /docs, /openapi.json, /redoc.
Em rotas protegidas, retorna 401 se nao houver token valido.
Define request.state.user_id e request.state.role (RBAC).
"""
import logging
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger("completepay.api")

try:
    import jwt
    _JWT_AVAILABLE = True
except ImportError:
    _JWT_AVAILABLE = False


# Rotas que nao exigem JWT (path pode ser prefixo; method exato)
PUBLIC_ROUTES = [
    ("GET", "/health"),
    ("POST", "/auth/register"),
    ("POST", "/auth/login"),
    ("POST", "/auth/confirm-email"),
    ("POST", "/auth/resend-confirmation"),
    ("POST", "/auth/forgot-password"),
    ("POST", "/auth/reset-password"),
    ("GET", "/"),
    ("GET", "/docs"),
    ("GET", "/redoc"),
    ("GET", "/openapi.json"),
    ("GET", "/api/v1/public/calendar"),
    ("POST", "/api/v1/public/calendar"),
    ("GET", "/uploads/avatars"),  # SBP-001: somente avatares publicos
    ("POST", "/api/v1/automations/webhooks/"),  # webhook de automações (autenticação por secret)
    ("POST", "/api/v1/email-marketing/webhooks/resend"),
    ("POST", "/api/v1/email-marketing/webhooks/inbound"),
    ("POST", "/api/v1/public/whatsapp/webhook/"),  # legado — manter por compatibilidade
    ("GET", "/api/v1/public/whatsapp/webhook/"),  # verificacao/healthcheck do provider
    ("POST", "/api/v1/whatsapp/webhook/"),  # webhook WhatsApp (autenticação por HMAC/account_id)
    ("GET", "/api/v1/whatsapp/webhook/"),  # verificacao/healthcheck do provider
]


def _is_public_request(method: str, path: str) -> bool:
    # Preflight CORS: navegador envia OPTIONS antes de POST/GET cross-origin; deve passar sem JWT
    if method.upper() == "OPTIONS":
        return True
    path_normalized = path.rstrip("/") or "/"
    for allowed_method, allowed_path in PUBLIC_ROUTES:
        if method.upper() != allowed_method:
            continue
        p = allowed_path.rstrip("/") or "/"
        if path_normalized == p or path_normalized.startswith(p + "/"):
            return True
    return False


def get_current_user_id(request: Request) -> Optional[str]:
    """Retorna o user_id do JWT em request.state ou None."""
    return getattr(request.state, "user_id", None)


def get_current_role(request: Request) -> Optional[str]:
    """Retorna o role do JWT em request.state ou None."""
    return getattr(request.state, "role", None)


def require_user_id(request: Request) -> str:
    """
    Para rotas protegidas: retorna o user_id do JWT ou levanta 401.
    Use como Depends(require_user_id).
    """
    from fastapi import HTTPException

    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Autenticacao necessaria.")
    return user_id


def require_role(required: str):
    """
    Dependencia RBAC: exige que o usuario tenha o role indicado (ex: "admin").
    Deve ser usada junto com rotas que ja exigem JWT (middleware).
    """

    def _require_role(request: Request) -> str:
        from fastapi import HTTPException

        role = get_current_role(request)
        if role != required:
            raise HTTPException(status_code=403, detail="Acesso negado: permissao insuficiente.")
        return role

    return _require_role


def decode_jwt(token: str, secret: str) -> Optional[dict]:
    """Decodifica e valida o JWT; retorna payload ou None."""
    if not _JWT_AVAILABLE:
        return None
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload
    except Exception:
        return None


class JwtRequiredMiddleware(BaseHTTPMiddleware):
    """
    Rotas publicas (lista acima): nao exige JWT; se houver Bearer, valida e seta user_id/role.
    Rotas protegidas: exige JWT valido; 401 se ausente ou invalido.
    """

    async def dispatch(self, request: Request, call_next):
        request.state.user_id = None
        request.state.role = None

        method = request.scope.get("method", "GET")
        path = request.scope.get("path", "")

        if _is_public_request(method, path):
            # Opcional: ainda assim preencher state se vier token
            auth = request.headers.get("Authorization")
            if auth and auth.startswith("Bearer "):
                token = auth[7:].strip()
                if token and _JWT_AVAILABLE:
                    from src.config.settings import get_settings
                    secret = get_settings().jwt_secret
                    if secret:
                        payload = decode_jwt(token, secret)
                        if payload and "sub" in payload:
                            request.state.user_id = str(payload.get("sub"))
                            request.state.role = (payload.get("role") or "user")
                            request.state.jti = payload.get("jti")
            return await call_next(request)

        # Rota protegida: exige JWT valido
        auth = request.headers.get("Authorization")
        if not auth or not auth.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Autenticacao necessaria."},
            )
        token = auth[7:].strip()
        if not token or not _JWT_AVAILABLE:
            return JSONResponse(
                status_code=401,
                content={"detail": "Token invalido ou ausente."},
            )
        from src.config.settings import get_settings
        secret = get_settings().jwt_secret
        if not secret:
            return JSONResponse(status_code=500, content={"detail": "Configuracao de auth indisponivel."})
        payload = decode_jwt(token, secret)
        if not payload or "sub" not in payload:
            return JSONResponse(
                status_code=401,
                content={"detail": "Token invalido ou expirado."},
            )
        jti = payload.get("jti")
        if jti:
            from src.auth.repository import is_jti_revoked
            if is_jti_revoked(jti):
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Sessao encerrada. Faca login novamente."},
                )
            request.state.jti = jti
        else:
            request.state.jti = None
        request.state.user_id = str(payload.get("sub"))
        request.state.role = payload.get("role") or "user"
        return await call_next(request)


# Alias para compatibilidade com codigo que ainda importa o nome antigo
JwtOptionalMiddleware = JwtRequiredMiddleware
