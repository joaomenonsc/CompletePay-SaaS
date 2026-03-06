"""Stub do provider Meta Official (Cloud API) — Fase 2."""
from typing import Any, Optional

from src.providers.whatsapp.base import (
    SendMessageResult,
    WhatsAppProviderInterface,
    WebhookPayload,
)


class MetaOfficialProvider(WhatsAppProviderInterface):
    """
    Provider Meta Official WhatsApp Cloud API.
    Stub para Fase 2. Implementar seguindo a interface da base.py.
    """

    def send_text(self, to_phone: str, text: str, *, instance: Optional[str] = None) -> SendMessageResult:
        raise NotImplementedError("MetaOfficialProvider: send_text não implementado (Fase 2).")

    def send_template(self, to_phone: str, template_name: str, language_code: str,
                      variables: Optional[dict[str, Any]] = None, *, instance: Optional[str] = None) -> SendMessageResult:
        raise NotImplementedError("MetaOfficialProvider: send_template não implementado (Fase 2).")

    def send_media(
        self,
        to_phone: str,
        media_url: str,
        media_type: str,
        caption: Optional[str] = None,
        media_mime_type: Optional[str] = None,
        media_filename: Optional[str] = None,
        *,
        instance: Optional[str] = None,
    ) -> SendMessageResult:
        raise NotImplementedError("MetaOfficialProvider: send_media não implementado (Fase 2).")

    def delete_message(
        self,
        to_phone: str,
        message_id: str,
        *,
        remote_jid: Optional[str] = None,
        instance: Optional[str] = None,
    ) -> SendMessageResult:
        raise NotImplementedError("MetaOfficialProvider: delete_message não implementado (Fase 2).")

    def parse_webhook(self, account_id: str, raw_payload: dict[str, Any]) -> list[WebhookPayload]:
        raise NotImplementedError("MetaOfficialProvider: parse_webhook não implementado (Fase 2).")

    def get_qrcode(self, instance: str) -> Optional[str]:
        return None  # Meta não usa QR Code — autenticação via Token

    def health(self) -> dict[str, Any]:
        return {"provider": "meta", "status": "stub", "implemented": False}
