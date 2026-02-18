"""
Entrypoint para a Vercel: exporta a aplicação FastAPI.
A Vercel procura por `app` em src/app.py, src/index.py ou app.py.
Em caso de falha na importação, expõe um app mínimo que retorna o erro (para debug).
"""
import traceback

try:
    from src.api.app import app
except Exception as e:
    from fastapi import FastAPI

    app = FastAPI(title="CompletePay Agent API (erro no startup)")

    @app.get("/")
    @app.get("/health")
    def _error_routes():
        """Retorna o erro de import para facilitar debug na Vercel."""
        return {
            "error": "FUNCTION_INVOCATION_FAILED",
            "message": str(e),
            "traceback": traceback.format_exc(),
            "hint": "Verifique: Root Directory = apps/backend; DATABASE_URL, CORS_ORIGINS e demais env vars nas configurações do projeto.",
        }

__all__ = ["app"]
