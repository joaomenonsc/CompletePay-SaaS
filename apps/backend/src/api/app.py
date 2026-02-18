"""
Aplicacao FastAPI - Fase 7.
Rotas /chat e /health; middleware de logging, rate limit e JWT opcional.
"""
import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.middleware.auth import JwtOptionalMiddleware
from src.api.middleware.logging_middleware import LoggingMiddleware
from src.api.middleware.rate_limit import RateLimitMiddleware
from src.api.middleware.security_headers import SecurityHeadersMiddleware
from src.api.routes.agents import router as agents_router
from src.api.routes.auth import router as auth_router
from src.api.routes.chat import router as chat_router
from src.api.routes.health import router as health_router
from src.api.routes.ws_chat import router as ws_chat_router
from src.api.routes.organizations import router as organizations_router
from src.config.logging_config import setup_logging
from src.config.settings import get_settings

load_dotenv()

# Logs estruturados: APP_ENV=production ou LOG_FORMAT=json (Fase 3.2 / 8)
settings = get_settings()
setup_logging(
    log_level=settings.log_level,
    log_format=settings.log_format or None,
    app_env=settings.app_env,
)
logger = logging.getLogger("completepay.api")

app = FastAPI(
    title="CompletePay Agent API",
    description="API do agente CompletePay (chat e health).",
    version="0.1.0",
)

# CORS: permite requisicoes do frontend. Em producao use apenas dominio(s) do frontend (Fase 3.3).
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if settings.app_env == "production" and origins:
    for o in origins:
        if "localhost" in o or o == "*":
            logger.warning("CORS em producao: evite localhost ou *; use apenas o dominio do frontend.")
            break
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ordem: primeiro adicionado = primeiro a executar. Security (HTTPS) e JWT antes do rate limit (Fase 3.3).
app.add_middleware(LoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(JwtOptionalMiddleware)
app.add_middleware(RateLimitMiddleware)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(organizations_router)
app.include_router(agents_router)
app.include_router(chat_router)
app.include_router(ws_chat_router)


@app.get("/")
def root() -> dict:
    """Raiz da API."""
    return {"service": "CompletePay Agent API", "docs": "/docs"}
