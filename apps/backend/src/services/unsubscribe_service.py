"""
Serviço de unsubscribe — geração e verificação de tokens HMAC para links de descadastro.

Os tokens são gerados com HMAC-SHA256 usando o jwt_secret da aplicação,
garantindo que apenas links legítimos possam descadastrar um subscriber.
"""
import hashlib
import hmac
import urllib.parse

from src.config.settings import get_settings


def _get_secret() -> str:
    """Retorna a chave secreta para assinatura HMAC."""
    return get_settings().jwt_secret


def generate_unsubscribe_token(subscriber_id: str, campaign_id: str) -> str:
    """
    Gera token HMAC-SHA256 para um par (subscriber_id, campaign_id).
    Retorna o token como hex string.
    """
    secret = _get_secret()
    message = f"{subscriber_id}:{campaign_id}"
    return hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_unsubscribe_token(subscriber_id: str, campaign_id: str, token: str) -> bool:
    """Verifica se o token HMAC é válido para o par (subscriber_id, campaign_id)."""
    expected = generate_unsubscribe_token(subscriber_id, campaign_id)
    return hmac.compare_digest(expected, token)


def build_unsubscribe_url(subscriber_id: str, campaign_id: str) -> str:
    """
    Constrói a URL completa de unsubscribe com parâmetros assinados.
    Exemplo: https://api.example.com/api/v1/email-marketing/unsubscribe?sid=...&cid=...&token=...
    """
    settings = get_settings()
    # Usar o backend URL (para produção) ou localhost
    # O frontend_url aponta para o frontend; para a API de unsubscribe, usamos a base do backend
    base_url = settings.frontend_url.rstrip("/")
    token = generate_unsubscribe_token(subscriber_id, campaign_id)

    params = urllib.parse.urlencode({
        "sid": subscriber_id,
        "cid": campaign_id,
        "token": token,
    })

    return f"{base_url}/api/v1/email-marketing/unsubscribe?{params}"
