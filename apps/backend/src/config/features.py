"""Feature Flags com Unleash (Onda 4.2 — Maturidade Operacional).

Permite canary deploy, rollback instantâneo sem redeploy, e testes A/B.

Uso:
    from src.config.features import is_enabled

    if is_enabled("new-patient-schema-v2", org_id=org_id):
        return new_response_v2()
    return legacy_response()

Graceful degradation: se UNLEASH_URL não estiver configurado, todas as flags
retornam False (= comportamento legado).
"""
import logging

from src.config.settings import get_settings

logger = logging.getLogger("completepay.features")

_client = None


def _get_client():
    """Retorna o cliente Unleash (lazy init)."""
    global _client
    if _client is not None:
        return _client

    settings = get_settings()
    unleash_url = getattr(settings, "unleash_url", "")
    if not unleash_url:
        logger.debug("UNLEASH_URL não configurado — feature flags desativadas.")
        _client = _NoopClient()
        return _client

    try:
        from UnleashClient import UnleashClient
        _client = UnleashClient(
            url=unleash_url,
            app_name="completepay-backend",
        )
        _client.initialize_client()
        logger.info("Unleash inicializado (url=%s).", unleash_url)
    except ImportError:
        logger.warning("UnleashClient não instalado — feature flags desativadas.")
        _client = _NoopClient()
    except Exception as e:
        logger.warning("Unleash falhou ao inicializar: %s — fallback noop.", e)
        _client = _NoopClient()

    return _client


def is_enabled(flag: str, org_id: str | None = None) -> bool:
    """Verifica se uma feature flag está ativa para o contexto dado."""
    context = {"userId": org_id} if org_id else {}
    try:
        return _get_client().is_enabled(flag, context=context)
    except Exception:
        return False


class _NoopClient:
    """Fallback quando Unleash não está configurado — todas as flags desativadas."""

    def is_enabled(self, *args, **kwargs) -> bool:
        return False
