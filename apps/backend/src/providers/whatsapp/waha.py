"""Stub do provider WAHA (WhatsApp HTTP API) — Fase 2."""
from typing import Any, Optional

from src.providers.whatsapp.base import (
    SendMessageResult,
    WhatsAppProviderInterface,
    WebhookPayload,
)


class WAHAProvider(WhatsAppProviderInterface):
    """
    Provider WAHA (self-hosted).
    Stub para Fase 2. Implementar seguindo a interface da base.py.
    """

    def send_text(self, to_phone: str, text: str, *, instance: Optional[str] = None) -> SendMessageResult:
        raise NotImplementedError("WAHAProvider: send_text não implementado (Fase 2).")

    def send_template(self, to_phone: str, template_name: str, language_code: str,
                      variables: Optional[dict[str, Any]] = None, *, instance: Optional[str] = None) -> SendMessageResult:
        raise NotImplementedError("WAHAProvider: send_template não implementado (Fase 2).")

    def send_media(self, to_phone: str, media_url: str, media_type: str,
                   caption: Optional[str] = None, *, instance: Optional[str] = None) -> SendMessageResult:
        raise NotImplementedError("WAHAProvider: send_media não implementado (Fase 2).")

    def parse_webhook(self, account_id: str, raw_payload: dict[str, Any]) -> list[WebhookPayload]:
        raise NotImplementedError("WAHAProvider: parse_webhook não implementado (Fase 2).")

    def get_qrcode(self, instance: str) -> Optional[str]:
        raise NotImplementedError("WAHAProvider: get_qrcode não implementado (Fase 2).")

    def health(self) -> dict[str, Any]:
        return {"provider": "waha", "status": "stub", "implemented": False}
