"""
Entrypoint para a Vercel: exporta a aplicação FastAPI.
A Vercel procura por `app` em src/app.py, src/index.py ou app.py.
Em caso de falha na importação, expõe um app mínimo que retorna o erro (para debug).
"""
import logging
import traceback

_startup_logger = logging.getLogger("completepay.startup")

try:
    from src.api.app import app
except Exception as e:
    # SBP-008: logar traceback apenas no servidor, retornar erro genérico ao cliente
    _startup_logger.critical("Falha no startup: %s\n%s", e, traceback.format_exc())

    from fastapi import FastAPI

    app = FastAPI(title="CompletePay Agent API (erro no startup)")

    @app.get("/")
    @app.get("/health")
    def _error_routes():
        """Retorna erro genérico (sem expor detalhes internos)."""
        return {
            "error": "FUNCTION_INVOCATION_FAILED",
            "message": "Erro interno no startup da aplicação. Verifique logs do servidor.",
            "hint": "Verifique: Root Directory = apps/backend; DATABASE_URL, CORS_ORIGINS e demais env vars.",
        }

__all__ = ["app"]
