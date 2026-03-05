"""
Aplicacao FastAPI - Fase 7.
Rotas /chat e /health; middleware de logging, rate limit e JWT opcional.
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.api.middleware.auth import JwtOptionalMiddleware
from src.api.middleware.correlation_middleware import CorrelationMiddleware
from src.api.middleware.logging_middleware import LoggingMiddleware
from src.api.middleware.rate_limit import RateLimitMiddleware
from src.api.middleware.security_headers import SecurityHeadersMiddleware
from src.api.routes.agents import router as agents_router
from src.api.routes.calendar import router as calendar_router
from src.api.routes.calendar_public import router as calendar_public_router
from src.api.routes.auth import router as auth_router
from src.api.routes.chat import router as chat_router
from src.api.routes.crm import router as crm_router
from src.api.routes.crm_marketing import router as email_marketing_router
from src.api.routes.emk_public import router as emk_public_router
from src.api.routes.health import router as health_router
from src.api.routes.ws_chat import router as ws_chat_router
from src.api.routes.organizations import router as organizations_router
from src.api.routes.automations import router as automations_router
from src.api.routes.automations_webhook import webhook_router as automations_webhook_router
from src.api.routes.document_routes import router as document_router
from src.api.routes.whatsapp import router as whatsapp_router
from src.api.routes.whatsapp_webhook import webhook_router as whatsapp_webhook_router
from src.api.routes.whatsapp_ws import router as whatsapp_ws_router
from src.config.logging_config import setup_logging
from src.config.sentry_config import init_sentry
from src.config.settings import get_settings
from src.config.telemetry import init_telemetry

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown: inicia clientes Evolution WebSocket para contas conectadas."""
    from src.ws.registry import evolution_registry
    try:
        await evolution_registry.start_all_connected_accounts()
    except Exception as exc:
        logging.getLogger("completepay.api").warning(
            "Falha ao iniciar Evolution WS clients: %s", exc
        )
    yield
    # Shutdown
    try:
        await evolution_registry.stop_all()
    except Exception:
        pass

# Sentry: inicializar antes de tudo para capturar erros de startup (Onda 0.2)
init_sentry()

# Logs estruturados: APP_ENV=production ou LOG_FORMAT=json (Fase 3.2 / 8)
settings = get_settings()
setup_logging(
    log_level=settings.log_level,
    log_format=settings.log_format or None,
    app_env=settings.app_env,
)
logger = logging.getLogger("completepay.api")

# SBP-011: desabilitar docs/openapi em producao
_is_prod = settings.app_env == "production"

app = FastAPI(
    title="CompletePay Agent API",
    description="API do agente CompletePay (chat e health).",
    version="0.1.0",
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
    lifespan=lifespan,
)

# CORS: permite requisicoes do frontend. Em producao use apenas dominio(s) do frontend (Fase 3.3).
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if not origins and settings.app_env != "production":
    origins = ["http://localhost:3000", "http://localhost:3003"]
if settings.app_env == "production" and origins:
    for o in origins:
        if "localhost" in o or o == "*":
            logger.warning("CORS em producao: evite localhost ou *; use apenas o dominio do frontend.")
            break
# SBP-014: restringir metodos e headers (evitar wildcard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Organization-Id", "X-Request-ID"],
)

# Ordem: primeiro adicionado = primeiro a executar.
# CorrelationMiddleware gera o X-Request-ID antes de tudo (Onda 0.3)
# LoggingMiddleware já inclui o request_id nos logs estruturados
app.add_middleware(LoggingMiddleware)
app.add_middleware(CorrelationMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(JwtOptionalMiddleware)
app.add_middleware(RateLimitMiddleware)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(organizations_router)
app.include_router(agents_router)
app.include_router(calendar_router)
app.include_router(calendar_public_router)
app.include_router(crm_router)
app.include_router(email_marketing_router)
app.include_router(emk_public_router)
app.include_router(chat_router)
app.include_router(ws_chat_router)
app.include_router(automations_router)
app.include_router(automations_webhook_router)
app.include_router(document_router)  # SBP-001: documentos via endpoint autenticado
app.include_router(whatsapp_router)
app.include_router(whatsapp_webhook_router)
app.include_router(whatsapp_ws_router)

# SBP-001: servir APENAS uploads publicos (avatares).
# Documentos clinicos devem ser acessados via endpoint autenticado (document_routes).
_uploads_base = Path(__file__).resolve().parent.parent.parent / "uploads"
_public_uploads_dir = _uploads_base / "avatars"
_public_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads/avatars", StaticFiles(directory=str(_public_uploads_dir)), name="uploads_avatars")

# --- Observabilidade (Onda 3) ---

# OpenTelemetry: tracing distribuído (Onda 3.1)
try:
    from src.db.session import _get_engine as _db_engine
    init_telemetry(app, engine=_db_engine())
except Exception:
    # Engine pode falhar se DB não estiver acessível no startup (cold start)
    init_telemetry(app)

# Prometheus: métricas USE em /metrics (Onda 3.3)
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
except ImportError:
    logger.debug("prometheus-fastapi-instrumentator não instalado — /metrics desativado.")


@app.get("/")
def root() -> dict:
    """Raiz da API."""
    return {"service": "CompletePay Agent API", "docs": "/docs"}
