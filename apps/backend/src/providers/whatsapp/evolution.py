"""
Adapter para Evolution API (self-hosted WhatsApp gateway).
Documentação: https://doc.evolution-api.com
"""
import hashlib
import logging
import re
from typing import Any, Optional

import httpx

from src.providers.whatsapp.base import (
    InboundMessage,
    SendMessageResult,
    StatusUpdate,
    WhatsAppProviderInterface,
    WebhookPayload,
)

logger = logging.getLogger("completepay.whatsapp.evolution")


def _normalize_phone(phone: str) -> str:
    """Remove caracteres não-digit e garante formato sem +."""
    return re.sub(r"\D", "", phone or "")


def _to_e164(phone_normalized: str) -> str:
    """Converte number normalizado para E.164 (com +)."""
    return f"+{phone_normalized}"


class EvolutionAPIProvider(WhatsAppProviderInterface):
    """
    Implementação do provider Evolution API.
    Suporta Evolution API v2 (REST + Websocket). Endpoints documentados em:
    https://doc.evolution-api.com/v2/api-reference
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        instance_name: str,
        timeout: float = 15.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._instance = instance_name
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "apikey": self._api_key,
        }

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        try:
            resp = httpx.post(url, json=body, headers=self._headers(), timeout=self._timeout)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Evolution API error: status=%s url=%s body=%.200s",
                exc.response.status_code, url, exc.response.text,
            )
            raise
        except httpx.TimeoutException:
            logger.error("Evolution API timeout: url=%s", url)
            raise

    def _get(self, path: str) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        try:
            resp = httpx.get(url, headers=self._headers(), timeout=self._timeout)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Evolution API GET error: status=%s url=%s",
                exc.response.status_code, url,
            )
            raise
        except httpx.TimeoutException:
            raise

    # ------------------------------------------------------------------
    # send_text
    # ------------------------------------------------------------------

    def send_text(
        self,
        to_phone: str,
        text: str,
        *,
        instance: Optional[str] = None,
    ) -> SendMessageResult:
        inst = instance or self._instance
        phone = _normalize_phone(to_phone)
        body = {
            "number": phone,
            "text": text,
        }
        try:
            resp = self._post(f"/message/sendText/{inst}", body)
            external_id = resp.get("key", {}).get("id") or resp.get("id") or ""
            return SendMessageResult(
                external_message_id=external_id,
                status="sent",
                provider_metadata=resp,
            )
        except Exception as e:
            return SendMessageResult(
                external_message_id="",
                status="failed",
                error=str(e),
            )

    # ------------------------------------------------------------------
    # send_template
    # ------------------------------------------------------------------

    def send_template(
        self,
        to_phone: str,
        template_name: str,
        language_code: str,
        variables: Optional[dict[str, Any]] = None,
        *,
        instance: Optional[str] = None,
    ) -> SendMessageResult:
        """
        Envia um template via Evolution API.
        Note: Evolution API representa templates como mensagens de texto formatadas
        com {{ variáveis }} interpoladas localmente (não usa Meta template approval).
        Para templates Meta BSP reais, usar o MetaOfficialProvider.
        """
        inst = instance or self._instance
        phone = _normalize_phone(to_phone)

        # Interpola variáveis no body (simplificado — production usa Jinja2)
        text = template_name
        if variables:
            for k, v in variables.items():
                text = text.replace(f"{{{{{k}}}}}", str(v))

        body = {
            "number": phone,
            "text": text,
        }
        try:
            resp = self._post(f"/message/sendText/{inst}", body)
            external_id = resp.get("key", {}).get("id") or resp.get("id") or ""
            return SendMessageResult(
                external_message_id=external_id,
                status="sent",
                provider_metadata=resp,
            )
        except Exception as e:
            return SendMessageResult(
                external_message_id="",
                status="failed",
                error=str(e),
            )

    # ------------------------------------------------------------------
    # send_media
    # ------------------------------------------------------------------

    def send_media(
        self,
        to_phone: str,
        media_url: str,
        media_type: str,
        caption: Optional[str] = None,
        *,
        instance: Optional[str] = None,
    ) -> SendMessageResult:
        inst = instance or self._instance
        phone = _normalize_phone(to_phone)

        # Evolution API: endpoint varia por tipo de mídia
        _type_map = {
            "image": "sendMedia",
            "audio": "sendMedia",
            "video": "sendMedia",
            "document": "sendMedia",
        }
        endpoint_suffix = _type_map.get(media_type.lower(), "sendMedia")

        body = {
            "number": phone,
            "mediatype": media_type.upper(),
            "media": media_url,
            "caption": caption or "",
        }
        try:
            resp = self._post(f"/message/{endpoint_suffix}/{inst}", body)
            external_id = resp.get("key", {}).get("id") or resp.get("id") or ""
            return SendMessageResult(
                external_message_id=external_id,
                status="sent",
                provider_metadata=resp,
            )
        except Exception as e:
            return SendMessageResult(
                external_message_id="",
                status="failed",
                error=str(e),
            )

    # ------------------------------------------------------------------
    # parse_webhook
    # ------------------------------------------------------------------

    def parse_webhook(
        self,
        account_id: str,
        raw_payload: dict[str, Any],
    ) -> list[WebhookPayload]:
        """
        Evolution API envia os eventos em formato:
        {
          "event": "messages.upsert",
          "instance": "nome-instancia",
          "data": { "key": {...}, "message": {...}, "messageType": "...", ... }
        }
        """
        results: list[WebhookPayload] = []
        event = raw_payload.get("event", "")

        if event in ("messages.upsert", "message.received"):
            payloads = self._parse_message_upsert(account_id, raw_payload)
            results.extend(payloads)

        elif event in ("messages.update", "message.delivered", "message.read", "message.failed"):
            payloads = self._parse_message_update(account_id, raw_payload)
            results.extend(payloads)

        else:
            # Evento desconhecido — logamos mas não falhamos (idempotência)
            logger.debug("Evolution webhook: evento desconhecido '%s'", event)
            results.append(WebhookPayload(
                account_id=account_id,
                event_type="unknown",
                raw=raw_payload,
            ))

        return results

    def _parse_message_upsert(
        self, account_id: str, raw: dict[str, Any]
    ) -> list[WebhookPayload]:
        data = raw.get("data", {})
        # Evolution pode enviar lista ou objeto único
        if isinstance(data, list):
            items = data
        else:
            items = [data]

        results = []
        for item in items:
            key = item.get("key", {})
            is_from_me = key.get("fromMe", False)
            if is_from_me:
                # Mensagem enviada por nós — ignorar para evitar duplicata loop
                continue

            remote_jid = key.get("remoteJid", "")
            phone_normalized = _normalize_phone(remote_jid.split("@")[0])
            if not phone_normalized:
                continue

            msg_type = item.get("messageType", "text").lower()
            # Mapeia tipos Evolution → nossos tipos
            type_map = {
                "conversation": "text",
                "extendedtextmessage": "text",
                "imagemessage": "image",
                "audiomessage": "audio",
                "videomessage": "video",  # guardamos como media_type video
                "documentmessage": "document",
                "stickermessage": "sticker",
                "locationmessage": "location",
                "templatemessage": "template",
            }
            mapped_type = type_map.get(msg_type, "text")

            message = item.get("message", {})
            body_text = (
                message.get("conversation")
                or message.get("extendedTextMessage", {}).get("text")
                or message.get("caption")
                or None
            )
            media_url = message.get("url") or None

            external_id = key.get("id", "") or ""

            inbound = InboundMessage(
                external_message_id=external_id,
                phone_normalized=phone_normalized,
                phone_e164=_to_e164(phone_normalized),
                direction="inbound",
                message_type=mapped_type,
                body_text=body_text,
                media_url=media_url,
                display_name=item.get("pushName"),
                provider_metadata=item,
            )
            results.append(WebhookPayload(
                account_id=account_id,
                event_type="message.received",
                inbound_messages=[inbound],
                raw=raw,
            ))

        return results

    def _parse_message_update(
        self, account_id: str, raw: dict[str, Any]
    ) -> list[WebhookPayload]:
        data = raw.get("data", {})
        items = data if isinstance(data, list) else [data]

        results = []
        for item in items:
            # Estrutura Evolution: {"key": {"id": "..."}, "update": {"status": "READ"}}
            key = item.get("key", {})
            external_id = key.get("id", "")
            update = item.get("update", {})
            evo_status = (update.get("status") or item.get("status") or "").upper()

            status_map = {
                "READ": "read",
                "DELIVERY_ACK": "delivered",
                "SENT": "sent",
                "ERROR": "failed",
            }
            status = status_map.get(evo_status, "delivered")
            error = item.get("error") or None

            su = StatusUpdate(
                external_message_id=external_id,
                status=status,
                error=error,
                provider_metadata=item,
            )
            mapped_event = {
                "read": "message.read",
                "delivered": "message.delivered",
                "failed": "message.failed",
            }.get(status, "message.delivered")

            results.append(WebhookPayload(
                account_id=account_id,
                event_type=mapped_event,
                status_updates=[su],
                raw=raw,
            ))

        return results

    # ------------------------------------------------------------------
    # get_qrcode
    # ------------------------------------------------------------------

    def get_qrcode(self, instance: str) -> Optional[str]:
        """
        Retorna QR Code base64 da instância Evolution.
        Usa o endpoint /instance/connect/{instance} da Evolution API v2.
        Retorna apenas o base64 puro (sem prefixo data:image/...).
        """
        inst = instance or self._instance
        try:
            resp = self._get(f"/instance/connect/{inst}")
            raw = resp.get("base64") or ""
            if not raw:
                return None
            # A Evolution API v2 retorna "data:image/png;base64,<dados>"
            # Removemos o prefixo para que o frontend monte a URL corretamente
            if "," in raw:
                return raw.split(",", 1)[1]
            return raw
        except Exception as e:
            logger.warning("get_qrcode falhou para instância '%s': %s", inst, e)
            return None

    # ------------------------------------------------------------------
    # health
    # ------------------------------------------------------------------

    def health(self) -> dict[str, Any]:
        """Verifica status da instância no Evolution."""
        try:
            resp = self._get(f"/instance/connectionState/{self._instance}")
            return {
                "provider": "evolution",
                "instance": self._instance,
                "state": resp.get("instance", {}).get("state", "unknown"),
                "ok": True,
            }
        except Exception as e:
            return {"provider": "evolution", "instance": self._instance, "ok": False, "error": str(e)}
