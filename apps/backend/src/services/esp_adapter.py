"""
ESP Adapter — interface abstrata para provedores de email (Email Service Provider).

Permite trocar o provedor (Resend, SES, SendGrid) sem alterar a logica de negocio.
Implementa rate limiting e batch chunking para envios em massa.
"""
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("completepay.esp_adapter")


# ── Data classes ────────────────────────────────────────────────────────────


@dataclass
class EmailMessage:
    """Representa um email individual para envio em batch."""

    to: str
    subject: str
    html: str
    headers: dict[str, str] = field(default_factory=dict)


@dataclass
class SendResult:
    """Resultado de um envio de email."""

    success: bool
    message_id: str | None = None
    error: str | None = None


# ── Abstract Interface ──────────────────────────────────────────────────────


class ESPAdapter(ABC):
    """Interface abstrata para provedores de email."""

    @abstractmethod
    def send_single(
        self,
        from_addr: str,
        to: str,
        subject: str,
        html: str,
        headers: dict[str, str] | None = None,
        text: str | None = None,
    ) -> SendResult:
        """Envia um unico email. Retorna SendResult."""
        ...

    @abstractmethod
    def send_batch(
        self,
        from_addr: str,
        messages: list[EmailMessage],
    ) -> list[SendResult]:
        """Envia uma lista de emails. Implementa chunking automatico."""
        ...

    @abstractmethod
    def get_status(self, esp_message_id: str) -> str | None:
        """Consulta o status de entrega de um email pelo ID do ESP."""
        ...

    @abstractmethod
    def verify_webhook(
        self, payload: bytes, signature: str, secret: str
    ) -> bool:
        """Verifica a assinatura de um webhook do ESP."""
        ...


# ── Resend Adapter ──────────────────────────────────────────────────────────


class ResendAdapter(ESPAdapter):
    """Implementacao concreta usando Resend como ESP."""

    # Resend batch API aceita no maximo 100 emails por chamada
    MAX_BATCH_SIZE = 100

    def __init__(
        self,
        api_key: str,
        rate_limit_per_second: float = 8.0,
    ):
        import resend

        resend.api_key = api_key
        self._resend = resend
        self._rate_limit_per_second = rate_limit_per_second
        self._min_interval = 1.0 / rate_limit_per_second if rate_limit_per_second > 0 else 0
        self._last_send_time: float = 0

    def _throttle(self) -> None:
        """Aplica rate limiting entre envios."""
        if self._min_interval <= 0:
            return
        now = time.monotonic()
        elapsed = now - self._last_send_time
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_send_time = time.monotonic()

    def send_single(
        self,
        from_addr: str,
        to: str,
        subject: str,
        html: str,
        headers: dict[str, str] | None = None,
        text: str | None = None,
    ) -> SendResult:
        self._throttle()
        try:
            params: dict[str, Any] = {
                "from": from_addr,
                "to": [to],
                "subject": subject,
                "html": html,
            }
            if headers:
                params["headers"] = headers
            if text:
                params["text"] = text
            result = self._resend.Emails.send(params)
            msg_id = result.get("id") if isinstance(result, dict) else str(result)
            return SendResult(success=True, message_id=msg_id)
        except Exception as e:
            logger.error("Resend send_single failed for %s: %s", to, e)
            return SendResult(success=False, error=str(e)[:500])

    def send_batch(
        self,
        from_addr: str,
        messages: list[EmailMessage],
    ) -> list[SendResult]:
        results: list[SendResult] = []
        # Chunking: dividir em blocos de MAX_BATCH_SIZE
        for i in range(0, len(messages), self.MAX_BATCH_SIZE):
            chunk = messages[i : i + self.MAX_BATCH_SIZE]
            for msg in chunk:
                result = self.send_single(
                    from_addr=from_addr,
                    to=msg.to,
                    subject=msg.subject,
                    html=msg.html,
                    headers=msg.headers or None,
                )
                results.append(result)
        return results

    def get_status(self, esp_message_id: str) -> str | None:
        try:
            result = self._resend.Emails.get(esp_message_id)
            if isinstance(result, dict):
                return result.get("status")
            return None
        except Exception as e:
            logger.error("Resend get_status failed for %s: %s", esp_message_id, e)
            return None

    def verify_webhook(
        self, payload: bytes, signature: str, secret: str
    ) -> bool:
        """
        Verifica assinatura de webhook Resend via svix.
        Requer a lib svix instalada; retorna False se nao disponivel.
        """
        try:
            from svix.webhooks import Webhook

            wh = Webhook(secret)
            wh.verify(payload, {"svix-signature": signature})
            return True
        except ImportError:
            logger.warning("svix not installed — webhook verification FAILED (fail-closed)")
            return False  # SBP-002: fail-closed — nunca aceitar sem verificação
        except Exception:
            return False


# ── Log Adapter (dev/test fallback) ─────────────────────────────────────────


class LogAdapter(ESPAdapter):
    """Adapter de fallback que apenas loga os emails sem enviar."""

    def send_single(
        self,
        from_addr: str,
        to: str,
        subject: str,
        html: str,
        headers: dict[str, str] | None = None,
        text: str | None = None,
    ) -> SendResult:
        logger.info(
            "[LogAdapter] send_single from=%s to=%s subject=%s (not sent)",
            from_addr,
            to,
            subject,
        )
        return SendResult(success=True, message_id=f"log-{to}")

    def send_batch(
        self,
        from_addr: str,
        messages: list[EmailMessage],
    ) -> list[SendResult]:
        logger.info(
            "[LogAdapter] send_batch from=%s count=%d (not sent)",
            from_addr,
            len(messages),
        )
        return [
            SendResult(success=True, message_id=f"log-{msg.to}")
            for msg in messages
        ]

    def get_status(self, esp_message_id: str) -> str | None:
        return "delivered"

    def verify_webhook(
        self, payload: bytes, signature: str, secret: str
    ) -> bool:
        return True


# ── Factory ─────────────────────────────────────────────────────────────────


def get_esp_adapter() -> ESPAdapter:
    """
    Retorna o adapter ESP adequado baseado na configuracao.
    - Com RESEND_API_KEY: retorna ResendAdapter
    - Sem API key: retorna LogAdapter (fallback dev/test)
    """
    from src.config.settings import get_settings

    settings = get_settings()
    if settings.resend_api_key:
        rate_limit = getattr(settings, "marketing_rate_limit_per_second", 8.0)
        return ResendAdapter(
            api_key=settings.resend_api_key,
            rate_limit_per_second=rate_limit,
        )
    logger.warning("No ESP API key configured — using LogAdapter (emails will NOT be sent)")
    return LogAdapter()
