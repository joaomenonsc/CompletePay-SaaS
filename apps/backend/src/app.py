"""
Entrypoint para a Vercel: exporta a aplicação FastAPI.
A Vercel procura por `app` em src/app.py, src/index.py ou app.py.
"""
from src.api.app import app

__all__ = ["app"]
