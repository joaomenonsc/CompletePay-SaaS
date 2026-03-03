"""Inicialização do Sentry no backend (Onda 0.2 — Performance & Confiabilidade).

Integra com FastAPI, SQLAlchemy e ARQ para captura automática de:
- Exceções não tratadas
- Queries lentas (via SQLAlchemyIntegration)
- Falhas em jobs ARQ

Graceful degradation: se SENTRY_DSN não estiver definido, o Sentry não é inicializado.
"""
import logging
import re

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from src.config.settings import get_settings

logger = logging.getLogger("completepay.sentry")

# Padrões PII para sanitização (LGPD)
_CPF_PATTERN = re.compile(r"\d{3}\.?\d{3}\.?\d{3}-?\d{2}")
_EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")


def _strip_pii(event: dict, hint: dict) -> dict | None:
    """Remove CPF e emails de eventos antes de enviar ao Sentry (LGPD)."""
    raw = str(event)
    if _CPF_PATTERN.search(raw) or _EMAIL_PATTERN.search(raw):
        # Sanitizar mensagens e breadcrumbs
        if "message" in event:
            event["message"] = _CPF_PATTERN.sub("[CPF_REDACTED]", event["message"])
            event["message"] = _EMAIL_PATTERN.sub("[EMAIL_REDACTED]", event["message"])
        if "breadcrumbs" in event:
            for crumb in event.get("breadcrumbs", {}).get("values", []):
                if "message" in crumb:
                    crumb["message"] = _CPF_PATTERN.sub("[CPF_REDACTED]", crumb["message"])
                    crumb["message"] = _EMAIL_PATTERN.sub("[EMAIL_REDACTED]", crumb["message"])
    return event


def init_sentry() -> None:
    """Inicializa o Sentry SDK. Não faz nada se SENTRY_DSN não estiver configurado."""
    settings = get_settings()
    dsn = getattr(settings, "sentry_dsn", "")
    if not dsn:
        logger.debug("Sentry DSN não configurado — Sentry desativado.")
        return

    integrations = [
        FastApiIntegration(transaction_style="endpoint"),
        SqlalchemyIntegration(),
    ]

    # ARQ integration é opcional (pode não estar instalada)
    try:
        from sentry_sdk.integrations.arq import ArqIntegration
        integrations.append(ArqIntegration())
    except ImportError:
        pass

    sentry_sdk.init(
        dsn=dsn,
        environment=settings.app_env,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.05,
        integrations=integrations,
        before_send=_strip_pii,
        send_default_pii=False,
    )
    logger.info("Sentry inicializado (env=%s).", settings.app_env)
