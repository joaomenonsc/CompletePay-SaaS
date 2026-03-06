"""
Adapter para Evolution API (self-hosted WhatsApp gateway).
Documentação: https://doc.evolution-api.com
"""
import base64
import binascii
import logging
import re
from datetime import datetime, timezone
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


def _sanitize_profile_url(value: Any) -> Optional[str]:
    if not value:
        return None
    candidate = str(value).strip()
    if not candidate:
        return None
    if candidate.lower() in {"null", "undefined"}:
        return None
    if candidate.startswith("http://") or candidate.startswith("https://"):
        return candidate
    return None


def _sanitize_media_url(value: Any) -> Optional[str]:
    if not value:
        return None
    candidate = str(value).strip()
    if not candidate:
        return None
    if candidate.lower() in {"null", "undefined"}:
        return None
    if candidate.startswith(("http://", "https://", "data:")):
        return candidate
    return None


def _extract_message_body_text(message: Any) -> Optional[str]:
    if not isinstance(message, dict):
        return None

    message = _unwrap_message_payload(message)

    conversation = message.get("conversation")
    if isinstance(conversation, str) and conversation.strip():
        return conversation

    extended = message.get("extendedTextMessage")
    if isinstance(extended, dict):
        text = extended.get("text")
        if isinstance(text, str) and text.strip():
            return text

    for media_key in (
        "imageMessage",
        "videoMessage",
        "documentMessage",
        "audioMessage",
    ):
        media = message.get(media_key)
        if not isinstance(media, dict):
            continue
        caption = media.get("caption") or media.get("text")
        if isinstance(caption, str) and caption.strip():
            return caption

    caption = message.get("caption")
    if isinstance(caption, str) and caption.strip():
        return caption

    return None


def _unwrap_message_payload(message: Any) -> dict[str, Any]:
    if not isinstance(message, dict):
        return {}

    current = message
    wrappers = (
        "ephemeralMessage",
        "viewOnceMessage",
        "viewOnceMessageV2",
        "viewOnceMessageV2Extension",
    )
    for _ in range(5):
        unwrapped = None
        for key in wrappers:
            wrapper = current.get(key)
            if isinstance(wrapper, dict):
                nested = wrapper.get("message")
                if isinstance(nested, dict):
                    unwrapped = nested
                    break
        if unwrapped is None:
            break
        current = unwrapped
    return current


def _extract_message_type(item: Any) -> str:
    if not isinstance(item, dict):
        return "text"

    raw_type = str(item.get("messageType") or "").strip().lower()
    wrapper_types = {
        "ephemeralmessage",
        "viewoncemessage",
        "viewoncemessagev2",
        "viewoncemessagev2extension",
    }
    if raw_type and raw_type not in wrapper_types:
        return raw_type

    message = _unwrap_message_payload(item.get("message"))
    if message:
        first_key = next(iter(message.keys()), "")
        if first_key:
            return str(first_key).lower()
    return raw_type or "text"


def _extract_media_payload(
    message: Any,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    if not isinstance(message, dict):
        return None, None, None

    message = _unwrap_message_payload(message)

    direct_url = _sanitize_media_url(message.get("url") or message.get("mediaUrl"))
    if direct_url:
        media_type = message.get("mimetype") or message.get("mimeType")
        filename = message.get("fileName") or message.get("filename")
        return (
            direct_url,
            str(media_type).strip() if media_type else None,
            str(filename).strip() if filename else None,
        )

    for media_key in (
        "imageMessage",
        "audioMessage",
        "pttMessage",
        "videoMessage",
        "documentMessage",
        "stickerMessage",
    ):
        media = message.get(media_key)
        if not isinstance(media, dict):
            continue

        media_url = _sanitize_media_url(
            media.get("url") or media.get("mediaUrl") or media.get("directPath")
        )
        media_type = media.get("mimetype") or media.get("mimeType")
        filename = media.get("fileName") or media.get("filename") or media.get("title")
        if media_url or media_type or filename:
            return (
                media_url,
                str(media_type).strip() if media_type else None,
                str(filename).strip() if filename else None,
            )

    return None, None, None


def _extract_profile_picture_url(item: dict[str, Any]) -> Optional[str]:
    direct_keys = (
        "profilePicUrl",
        "profilePictureUrl",
        "profile_picture_url",
        "senderPic",
        "senderProfilePic",
    )
    for key in direct_keys:
        direct = _sanitize_profile_url(item.get(key))
        if direct:
            return direct

    nested_keys = (
        "sender",
        "contact",
        "participant",
        "messageContextInfo",
    )
    for parent_key in nested_keys:
        parent = item.get(parent_key)
        if not isinstance(parent, dict):
            continue
        for key in direct_keys:
            nested = _sanitize_profile_url(parent.get(key))
            if nested:
                return nested

    return None


def _extract_phone_from_evolution_payload(
    key: dict[str, Any],
    sender: str | None = None,
) -> str:
    """
    Extrai telefone de payload Evolution priorizando JIDs reais (@s.whatsapp.net).
    Eventos recentes podem trazer remoteJid em formato @lid e o número real em
    remoteJidAlt/sender.
    """
    group_id = _extract_group_chat_identifier(key)
    if group_id:
        return group_id

    candidates: list[str] = []
    for raw_candidate in (
        key.get("remoteJidAlt"),
        key.get("remoteJid"),
        key.get("participantAlt"),
        key.get("participant"),
        sender,
    ):
        if raw_candidate:
            candidates.append(str(raw_candidate))

    for candidate in candidates:
        local, sep, domain = candidate.partition("@")
        phone_candidate = _normalize_phone(local if sep else candidate)
        if not phone_candidate:
            continue
        # IDs LID não são números discáveis; preferir alternativas.
        if domain.lower() == "lid":
            continue
        return phone_candidate

    return ""


def _extract_group_chat_identifier(key: dict[str, Any]) -> str:
    if not isinstance(key, dict):
        return ""
    for raw_candidate in (
        key.get("remoteJid"),
        key.get("remoteJidAlt"),
        key.get("participant"),
        key.get("participantAlt"),
    ):
        if not raw_candidate:
            continue
        local, sep, domain = str(raw_candidate).partition("@")
        if not sep or domain.lower() != "g.us":
            continue
        normalized = _normalize_phone(local)
        if normalized:
            return normalized
        fallback = re.sub(r"[^a-zA-Z0-9_-]", "", local)
        if fallback:
            return fallback[:20]
    return ""


def _extract_chat_display_name(item: dict[str, Any], phone_normalized: str) -> Optional[str]:
    key = item.get("key") if isinstance(item.get("key"), dict) else {}
    group_id = _extract_group_chat_identifier(key)
    if group_id:
        for source in (
            item,
            item.get("groupMetadata"),
            item.get("chat"),
            item.get("contextInfo"),
        ):
            if not isinstance(source, dict):
                continue
            for field in ("groupName", "groupSubject", "subject", "chatName", "conversationName", "name"):
                value = source.get(field)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        return f"Grupo {phone_normalized}"

    push_name = item.get("pushName")
    if isinstance(push_name, str) and push_name.strip():
        return push_name.strip()
    return None


def _looks_like_message_event(raw_payload: dict[str, Any]) -> bool:
    data = raw_payload.get("data")
    items = data if isinstance(data, list) else [data]
    for item in items:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        message = item.get("message")
        if isinstance(key, dict) and (
            isinstance(message, dict)
            or bool(item.get("messageType"))
            or isinstance(item.get("content"), dict)
        ):
            return True
    return False


def _to_timestamp_seconds(raw_value: Any) -> int:
    if raw_value is None:
        return 0
    if isinstance(raw_value, dict):
        low = raw_value.get("low")
        high = raw_value.get("high")
        if isinstance(low, (int, float)):
            if isinstance(high, (int, float)):
                try:
                    combined = (int(high) << 32) + int(low)
                    if combined > 0:
                        return combined
                except Exception:
                    pass
            return int(low)
        return 0
    if isinstance(raw_value, str):
        raw_value = raw_value.strip()
        if not raw_value:
            return 0
    try:
        ts = int(float(raw_value))
    except Exception:
        return 0
    if ts <= 0:
        return 0
    # Alguns payloads podem vir em milissegundos.
    if ts > 10_000_000_000:
        ts = ts // 1000
    return ts


def _extract_message_datetime(item: Any) -> Optional[datetime]:
    if not isinstance(item, dict):
        return None
    raw_candidates = (
        item.get("messageTimestamp"),
        item.get("message_timestamp"),
        item.get("timestamp"),
    )
    for raw_value in raw_candidates:
        ts = _to_timestamp_seconds(raw_value)
        if ts <= 0:
            continue
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        except Exception:
            continue
    return None


def _normalize_group_jid(group_id_or_jid: str) -> str:
    raw = str(group_id_or_jid or "").strip()
    if not raw:
        return ""
    if "@" in raw:
        local, sep, domain = raw.partition("@")
        if sep and domain.lower() == "g.us":
            normalized = _normalize_phone(local)
            if normalized:
                return f"{normalized}@g.us"
            fallback = re.sub(r"[^a-zA-Z0-9_-]", "", local)
            return f"{fallback}@g.us" if fallback else ""
        normalized = _normalize_phone(local)
        return f"{normalized}@g.us" if normalized else ""
    normalized = _normalize_phone(raw)
    if normalized:
        return f"{normalized}@g.us"
    fallback = re.sub(r"[^a-zA-Z0-9_-]", "", raw)
    return f"{fallback}@g.us" if fallback else ""


def _extract_group_identifier(value: Any) -> str:
    if not value:
        return ""
    raw = str(value).strip()
    if not raw:
        return ""
    local, sep, domain = raw.partition("@")
    if sep and domain.lower() == "g.us":
        normalized = _normalize_phone(local)
        if normalized:
            return f"{normalized}@g.us"
        fallback = re.sub(r"[^a-zA-Z0-9_-]", "", local)
        return f"{fallback}@g.us" if fallback else ""
    # Alguns endpoints retornam "id" sem domínio para grupo.
    normalized = _normalize_phone(raw)
    if len(normalized) >= 15:
        return f"{normalized}@g.us"
    return ""


def _extract_group_subject(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    if not candidate:
        return None
    if candidate.lower() in {"null", "undefined"}:
        return None
    return candidate


def _iter_nested_dicts(payload: Any, *, max_depth: int = 5) -> list[dict[str, Any]]:
    if max_depth <= 0:
        return []
    found: list[dict[str, Any]] = []
    if isinstance(payload, dict):
        found.append(payload)
        for nested in payload.values():
            found.extend(_iter_nested_dicts(nested, max_depth=max_depth - 1))
    elif isinstance(payload, list):
        for item in payload:
            found.extend(_iter_nested_dicts(item, max_depth=max_depth - 1))
    return found


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

    def _post(
        self,
        path: str,
        body: dict[str, Any],
        *,
        suppress_http_error_log: bool = False,
    ) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        try:
            resp = httpx.post(url, json=body, headers=self._headers(), timeout=self._timeout)
            resp.raise_for_status()
            if not resp.content:
                return {}
            content_type = str(resp.headers.get("content-type") or "").lower()
            if "application/json" in content_type:
                return resp.json()
            try:
                return resp.json()
            except Exception:
                return {"raw": resp.text}
        except httpx.HTTPStatusError as exc:
            if not suppress_http_error_log:
                logger.error(
                    "Evolution API error: status=%s url=%s body=%.200s",
                    exc.response.status_code, url, exc.response.text,
                )
            raise
        except httpx.TimeoutException:
            logger.error("Evolution API timeout: url=%s", url)
            raise

    def _delete(
        self,
        path: str,
        body: Optional[dict[str, Any]] = None,
        *,
        suppress_http_error_log: bool = False,
    ) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        try:
            resp = httpx.request(
                "DELETE",
                url,
                json=(body or {}),
                headers=self._headers(),
                timeout=self._timeout,
            )
            resp.raise_for_status()
            if not resp.content:
                return {}
            content_type = str(resp.headers.get("content-type") or "").lower()
            if "application/json" in content_type:
                return resp.json()
            try:
                return resp.json()
            except Exception:
                return {"raw": resp.text}
        except httpx.HTTPStatusError as exc:
            if not suppress_http_error_log:
                logger.error(
                    "Evolution API DELETE error: status=%s url=%s body=%.200s",
                    exc.response.status_code, url, exc.response.text,
                )
            raise
        except httpx.TimeoutException:
            logger.error("Evolution API timeout: url=%s", url)
            raise

    def _get(self, path: str, params: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        try:
            resp = httpx.get(
                url,
                headers=self._headers(),
                params=params,
                timeout=self._timeout,
            )
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
    # fetch_recent_messages (fallback sync)
    # ------------------------------------------------------------------

    def fetch_recent_messages(
        self,
        *,
        phone_normalized: str,
        instance: Optional[str] = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """
        Busca mensagens recentes da instância para um contato específico.
        Usado como fallback quando webhook/socket não entrega eventos fromMe.
        """
        inst = instance or self._instance
        phone = _normalize_phone(phone_normalized)
        if not phone:
            return []

        path = f"/chat/findMessages/{inst}"
        jids = [
            f"{phone}@s.whatsapp.net",
            f"{phone}@lid",
        ]
        candidate_bodies: list[dict[str, Any]] = []
        for jid in jids:
            candidate_bodies.append(
                {"where": {"key": {"remoteJidAlt": jid}}, "limit": limit}
            )
            candidate_bodies.append(
                {"where": {"key": {"remoteJid": jid}}, "limit": limit}
            )
            candidate_bodies.append(
                {"where": {"key.remoteJidAlt": jid}, "limit": limit}
            )
            candidate_bodies.append(
                {"where": {"key.remoteJid": jid}, "limit": limit}
            )
        candidate_bodies.append({"limit": limit})

        by_external_id: dict[str, dict[str, Any]] = {}
        for body in candidate_bodies:
            try:
                resp = self._post(path, body)
            except Exception:
                continue

            messages = resp.get("messages") if isinstance(resp, dict) else None
            records = messages.get("records") if isinstance(messages, dict) else None
            if not isinstance(records, list):
                continue

            for item in records:
                if not isinstance(item, dict):
                    continue
                key = item.get("key")
                if not isinstance(key, dict):
                    continue
                external_id = key.get("id")
                if not external_id:
                    continue
                remote_jid = str(key.get("remoteJid") or "")
                remote_jid_alt = str(key.get("remoteJidAlt") or "")
                if remote_jid or remote_jid_alt:
                    normalized = {
                        _normalize_phone(remote_jid.partition("@")[0]),
                        _normalize_phone(remote_jid_alt.partition("@")[0]),
                    }
                    if phone not in normalized:
                        continue
                by_external_id[str(external_id)] = item

            if len(by_external_id) >= limit:
                break

        items = list(by_external_id.values())
        items.sort(key=lambda x: _to_timestamp_seconds(x.get("messageTimestamp")))
        return items[-limit:]

    # ------------------------------------------------------------------
    # fetch_profile_picture_url (best effort)
    # ------------------------------------------------------------------

    def fetch_profile_picture_url(self, phone_or_jid: str) -> Optional[str]:
        """
        Busca avatar do contato via Evolution API.
        Endpoint validado em produção: POST /chat/fetchProfilePictureUrl/{instance}
        body: {"number": "<digits|jid>"}.
        """
        inst = self._instance
        phone_or_jid = (phone_or_jid or "").strip()
        if not phone_or_jid:
            return None

        # Mantém JID se já veio nesse formato; caso contrário, normaliza para dígitos.
        number = (
            phone_or_jid
            if "@" in phone_or_jid
            else _normalize_phone(phone_or_jid)
        )
        if not number:
            return None

        try:
            resp = self._post(
                f"/chat/fetchProfilePictureUrl/{inst}",
                {"number": number},
            )
            return _sanitize_profile_url(resp.get("profilePictureUrl"))
        except Exception:
            logger.debug(
                "Evolution fetch_profile_picture_url falhou: instance=%s number=%s",
                inst,
                number,
                exc_info=True,
            )
            return None

    def fetch_group_subject(self, group_id_or_jid: str) -> Optional[str]:
        """
        Busca o nome/subject oficial de um grupo no Evolution.
        Estratégia: tenta endpoint direto por JID e fallback para lista de grupos.
        """
        inst = self._instance
        group_jid = _normalize_group_jid(group_id_or_jid)
        if not group_jid:
            return None

        def pick_subject_from_response(resp_payload: Any) -> Optional[str]:
            dicts = _iter_nested_dicts(resp_payload)
            if not dicts:
                return None

            candidate_fields = (
                "subject",
                "groupSubject",
                "groupName",
                "conversationName",
                "chatName",
                "name",
                "title",
            )

            # Busca apenas em objetos que referenciam o grupo consultado.
            for item in dicts:
                group_candidates: list[str] = []
                for key_field in ("id", "jid", "groupJid", "remoteJid", "chatJid"):
                    candidate = _extract_group_identifier(item.get(key_field))
                    if candidate:
                        group_candidates.append(candidate)
                key_obj = item.get("key")
                if isinstance(key_obj, dict):
                    for key_field in ("remoteJid", "remoteJidAlt"):
                        candidate = _extract_group_identifier(key_obj.get(key_field))
                        if candidate:
                            group_candidates.append(candidate)
                item_group_jid = next((c for c in group_candidates if c), "")
                if item_group_jid != group_jid:
                    continue
                for field in candidate_fields:
                    subject = _extract_group_subject(item.get(field))
                    if subject:
                        return subject

            return None

        # Endpoints oficiais de grupo (GET + query params).
        candidate_get_requests: list[tuple[str, Optional[dict[str, Any]]]] = [
            (f"/group/findGroupInfos/{inst}", {"groupJid": group_jid}),
            (f"/group/findGroupInfos/{inst}", {"groupJid": group_jid.split('@')[0]}),
            (f"/group/fetchAllGroups/{inst}", {"getParticipants": "false"}),
            (f"/group/fetchAllGroups/{inst}", None),
        ]

        for path, params in candidate_get_requests:
            try:
                resp = self._get(path, params=params)
                subject = pick_subject_from_response(resp)
                if subject:
                    logger.info(
                        "Evolution group subject resolvido: instance=%s group=%s subject=%s",
                        inst,
                        group_jid,
                        subject,
                    )
                    return subject
            except Exception:
                continue

        # Fallback para versões onde group/* não está disponível.
        candidate_post_requests: list[tuple[str, dict[str, Any]]] = [
            (f"/chat/findChats/{inst}", {"limit": 500}),
            (f"/chat/findChats/{inst}", {"limit": 200}),
            (f"/chat/findChats/{inst}", {}),
        ]
        for path, body in candidate_post_requests:
            try:
                resp = self._post(path, body)
                subject = pick_subject_from_response(resp)
                if subject:
                    logger.info(
                        "Evolution group subject resolvido via chat/findChats: "
                        "instance=%s group=%s subject=%s",
                        inst,
                        group_jid,
                        subject,
                    )
                    return subject
            except Exception:
                continue

        try:
            resp = self._get(f"/chat/findChats/{inst}")
            subject = pick_subject_from_response(resp)
            if subject:
                logger.info(
                    "Evolution group subject resolvido via GET: instance=%s group=%s subject=%s",
                    inst,
                    group_jid,
                    subject,
                )
                return subject
        except Exception:
            logger.debug(
                "Evolution fetch_group_subject falhou: instance=%s group=%s",
                inst,
                group_jid,
                exc_info=True,
            )
        return None

    # ------------------------------------------------------------------
    # fetch_media_content (best effort)
    # ------------------------------------------------------------------

    def fetch_media_content(
        self,
        raw_message_payload: dict[str, Any],
        *,
        instance: Optional[str] = None,
    ) -> tuple[bytes, str, Optional[str]]:
        """
        Busca mídia decodificada de uma mensagem via Evolution API.
        Endpoint: POST /chat/getBase64FromMediaMessage/{instance}
        Body: payload completo da mensagem original (provider_metadata).
        """
        inst = instance or self._instance
        if not isinstance(raw_message_payload, dict) or not raw_message_payload:
            raise ValueError("Payload da mensagem inválido para buscar mídia.")

        path = f"/chat/getBase64FromMediaMessage/{inst}"
        candidate_bodies: list[dict[str, Any]] = [
            # Compat com Evolution que espera body.message.<key|message>.
            {"message": raw_message_payload},
            # Compat retroativa com deploys que aceitam payload direto.
            raw_message_payload,
        ]
        message_node = raw_message_payload.get("message")
        if isinstance(message_node, dict):
            candidate_bodies.append({"message": message_node})

        last_error: Optional[Exception] = None
        resp: Optional[dict[str, Any]] = None
        for body in candidate_bodies:
            try:
                resp = self._post(path, body)
                break
            except Exception as exc:
                last_error = exc
                continue
        if resp is None:
            raise last_error or RuntimeError("Falha ao obter mídia na Evolution.")
        encoded = resp.get("base64")
        if not isinstance(encoded, str) or not encoded.strip():
            raise ValueError("Evolution não retornou mídia em base64.")

        media_type = str(resp.get("mimetype") or resp.get("mimeType") or "").strip()
        filename_raw = resp.get("fileName") or resp.get("filename")
        filename = str(filename_raw).strip() if filename_raw else None

        hinted_type: Optional[str] = None
        payload = encoded.strip()
        if payload.startswith("data:") and "," in payload:
            header, payload = payload.split(",", 1)
            match = re.match(r"^data:([^;]+)", header, re.IGNORECASE)
            if match:
                hinted_type = match.group(1).strip()

        payload = payload.strip()
        if not payload:
            raise ValueError("Base64 de mídia vazio.")

        # Alguns payloads chegam sem padding; corrigimos antes de decodificar.
        missing_padding = len(payload) % 4
        if missing_padding:
            payload += "=" * (4 - missing_padding)

        try:
            content = base64.b64decode(payload, validate=False)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Falha ao decodificar base64 de mídia.") from exc

        if not content:
            raise ValueError("Conteúdo de mídia vazio após decodificação.")

        effective_media_type = media_type or hinted_type or "application/octet-stream"
        return content, effective_media_type, filename

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
        media_mime_type: Optional[str] = None,
        media_filename: Optional[str] = None,
        *,
        instance: Optional[str] = None,
    ) -> SendMessageResult:
        inst = instance or self._instance
        phone = _normalize_phone(to_phone)
        normalized_media_type = str(media_type or "").strip().lower() or "document"
        media_payload = str(media_url or "").strip()
        detected_mime_type = str(media_mime_type or "").strip() or None

        # Compatibilidade com payload data URL; Evolution costuma aceitar base64 puro.
        if media_payload.startswith("data:") and "," in media_payload:
            header, raw_payload = media_payload.split(",", 1)
            match = re.match(r"^data:([^;]+)", header, re.IGNORECASE)
            if match and not detected_mime_type:
                detected_mime_type = match.group(1).strip()
            media_payload = raw_payload.strip()

        # Evolution API: endpoint varia por tipo de mídia
        _type_map = {
            "image": "sendMedia",
            "audio": "sendMedia",
            "video": "sendMedia",
            "document": "sendMedia",
        }
        endpoint_suffix = _type_map.get(normalized_media_type, "sendMedia")

        body = {
            "number": phone,
            "mediatype": normalized_media_type,
            "media": media_payload,
        }
        if caption:
            body["caption"] = caption
        if detected_mime_type:
            body["mimetype"] = detected_mime_type
        if media_filename:
            body["fileName"] = media_filename

        try:
            resp = self._post(f"/message/{endpoint_suffix}/{inst}", body)
            external_id = resp.get("key", {}).get("id") or resp.get("id") or ""
            return SendMessageResult(
                external_message_id=external_id,
                status="sent",
                provider_metadata=resp,
            )
        except httpx.HTTPStatusError as e:
            detail = str((e.response.text or "").strip())[:300]
            if detail:
                error = f"Evolution {e.response.status_code}: {detail}"
            else:
                error = str(e)
            return SendMessageResult(
                external_message_id="",
                status="failed",
                error=error,
            )
        except Exception as e:
            return SendMessageResult(
                external_message_id="",
                status="failed",
                error=str(e),
            )

    def update_message_text(
        self,
        to_phone: str,
        message_id: str,
        new_text: str,
        *,
        remote_jid: Optional[str] = None,
        instance: Optional[str] = None,
    ) -> SendMessageResult:
        """
        Edita mensagem enviada via Evolution.
        Endpoint: POST /chat/updateMessage/{instance}
        """
        inst = instance or self._instance
        phone = _normalize_phone(to_phone)
        text = str(new_text or "").strip()
        if not phone:
            return SendMessageResult(
                external_message_id=message_id or "",
                status="failed",
                error="Telefone inválido para edição de mensagem.",
            )
        if not message_id:
            return SendMessageResult(
                external_message_id="",
                status="failed",
                error="ID da mensagem é obrigatório para edição.",
            )
        if not text:
            return SendMessageResult(
                external_message_id=message_id,
                status="failed",
                error="Texto da edição não pode ser vazio.",
            )

        normalized_remote_jid = str(remote_jid or "").strip()
        if "@" not in normalized_remote_jid:
            normalized_remote_jid = f"{phone}@s.whatsapp.net"

        body = {
            "number": phone,
            "text": text,
            "key": {
                "remoteJid": normalized_remote_jid,
                "fromMe": True,
                "id": message_id,
            },
        }

        try:
            resp = self._post(f"/chat/updateMessage/{inst}", body)
            return SendMessageResult(
                external_message_id=message_id,
                status="sent",
                provider_metadata=resp,
            )
        except httpx.HTTPStatusError as e:
            detail = str((e.response.text or "").strip())[:300]
            if detail:
                error = f"Evolution {e.response.status_code}: {detail}"
            else:
                error = str(e)
            return SendMessageResult(
                external_message_id=message_id,
                status="failed",
                error=error,
            )
        except Exception as e:
            return SendMessageResult(
                external_message_id=message_id,
                status="failed",
                error=str(e),
            )

    def delete_message(
        self,
        to_phone: str,
        message_id: str,
        *,
        remote_jid: Optional[str] = None,
        instance: Optional[str] = None,
    ) -> SendMessageResult:
        """
        Apaga mensagem enviada via Evolution.
        Compatibilidade:
        - v2 recente: DELETE /chat/deleteMessageForEveryone/{instance}
        - variações antigas: POST/DELETE em /chat/deleteMessage/{instance}
        """
        inst = instance or self._instance
        phone = _normalize_phone(to_phone)
        if not phone:
            return SendMessageResult(
                external_message_id=message_id or "",
                status="failed",
                error="Telefone inválido para apagar mensagem.",
            )
        if not message_id:
            return SendMessageResult(
                external_message_id="",
                status="failed",
                error="ID da mensagem é obrigatório para apagar.",
            )

        normalized_remote_jid = str(remote_jid or "").strip() or f"{phone}@s.whatsapp.net"
        candidate_remote_jids = [normalized_remote_jid]
        if normalized_remote_jid.endswith("@s.whatsapp.net"):
            candidate_remote_jids.append(normalized_remote_jid.replace("@s.whatsapp.net", "@c.us"))
        # dedup preservando ordem
        candidate_remote_jids = list(dict.fromkeys(candidate_remote_jids))

        # Ordem otimizada para Evolution v2 observada em produção:
        # 1) DELETE /chat/deleteMessageForEveryone/{instance} com id/fromMe/remoteJid no root.
        # Demais tentativas ficam como fallback de compatibilidade.
        candidate_requests: list[tuple[str, str, dict[str, Any], bool]] = []
        for candidate_jid in candidate_remote_jids:
            primary_body = {
                "id": message_id,
                "fromMe": True,
                "remoteJid": candidate_jid,
            }
            candidate_requests.append((
                "DELETE",
                f"/chat/deleteMessageForEveryone/{inst}",
                primary_body,
                False,  # erro aqui merece log (é rota principal)
            ))

            # Fallbacks silenciosos para evitar ruído de log com rotas não suportadas.
            key_payload = {
                "remoteJid": candidate_jid,
                "fromMe": True,
                "id": message_id,
            }
            fallback_bodies: list[dict[str, Any]] = [
                {"number": phone, "id": message_id, "remoteJid": candidate_jid, "fromMe": True},
                {"id": message_id, "remoteJid": candidate_jid, "fromMe": True, "number": phone},
                {"id": message_id, "key": key_payload},
                {"number": phone, "key": key_payload},
                {"messageId": message_id, "remoteJid": candidate_jid, "number": phone},
            ]
            for body in fallback_bodies:
                candidate_requests.extend([
                    ("DELETE", f"/chat/deleteMessageForEveryone/{inst}", body, True),
                    ("DELETE", f"/chat/deleteMessage/{inst}", body, True),
                    ("POST", f"/chat/deleteMessageForEveryone/{inst}", body, True),
                    ("POST", f"/chat/deleteMessage/{inst}", body, True),
                ])

        last_http_error: Optional[httpx.HTTPStatusError] = None
        last_non_404_http_error: Optional[httpx.HTTPStatusError] = None
        last_exception: Optional[Exception] = None
        for method, path, body, silent_on_http_error in candidate_requests:
            try:
                if method == "DELETE":
                    resp = self._delete(
                        path,
                        body,
                        suppress_http_error_log=silent_on_http_error,
                    )
                else:
                    resp = self._post(
                        path,
                        body,
                        suppress_http_error_log=silent_on_http_error,
                    )
                return SendMessageResult(
                    external_message_id=message_id,
                    status="sent",
                    provider_metadata=resp,
                )
            except httpx.HTTPStatusError as e:
                last_http_error = e
                if e.response.status_code != 404:
                    last_non_404_http_error = e
                if silent_on_http_error:
                    continue
                continue
            except Exception as e:
                last_exception = e
                continue

        chosen_http_error = last_non_404_http_error or last_http_error
        if chosen_http_error is not None:
            detail = str((chosen_http_error.response.text or "").strip())[:300]
            if detail:
                error = f"Evolution {chosen_http_error.response.status_code}: {detail}"
            else:
                error = str(chosen_http_error)
            return SendMessageResult(
                external_message_id=message_id,
                status="failed",
                error=error,
            )

        return SendMessageResult(
            external_message_id=message_id,
            status="failed",
            error=str(last_exception or "Falha ao apagar mensagem no provider."),
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
        event = str(raw_payload.get("event", "")).strip()
        event_lower = event.lower()

        message_events = {
            "messages.upsert",
            "message.received",
            "send.message",
            "message.create",
            "message.new",
            "messages.set",
            "messages.received",
            "messages.append",
            "send_message",
            "messages_set",
            "message_received",
            "messages_upsert",
        }

        if event_lower in message_events or _looks_like_message_event(raw_payload):
            payloads = self._parse_message_upsert(account_id, raw_payload)
            results.extend(payloads)

        elif event_lower in ("messages.update", "message.delivered", "message.read", "message.failed"):
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
        payload_sender = raw.get("sender")
        # Evolution pode enviar lista ou objeto único
        if isinstance(data, list):
            items = data
        else:
            items = [data]

        results = []
        for item in items:
            key = item.get("key", {})
            is_from_me = key.get("fromMe", False)

            remote_jid = key.get("remoteJid", "")
            phone_normalized = _extract_phone_from_evolution_payload(
                key=key,
                sender=(item.get("sender") or payload_sender),
            )
            if not phone_normalized:
                logger.warning(
                    "Evolution webhook sem telefone mapeável. remoteJid=%s account_id=%s",
                    remote_jid,
                    account_id,
                )
                continue

            # Mapeia tipos Evolution → nossos tipos
            type_map = {
                "conversation": "text",
                "extendedtextmessage": "text",
                "imagemessage": "image",
                "audiomessage": "audio",
                "pttmessage": "audio",
                "videomessage": "video",  # guardamos como media_type video
                "documentmessage": "document",
                "stickermessage": "sticker",
                "locationmessage": "location",
                "templatemessage": "template",
            }
            mapped_type = type_map.get(_extract_message_type(item), "text")

            message = item.get("message", {})
            body_text = _extract_message_body_text(message)
            media_url, media_type, media_filename = _extract_media_payload(message)
            message_at = _extract_message_datetime(item)

            external_id = key.get("id", "") or ""

            inbound = InboundMessage(
                external_message_id=external_id,
                phone_normalized=phone_normalized,
                phone_e164=_to_e164(phone_normalized),
                direction="outbound" if is_from_me else "inbound",
                message_type=mapped_type,
                body_text=body_text,
                media_url=media_url,
                media_type=media_type,
                media_filename=media_filename,
                received_at=message_at.isoformat() if message_at else None,
                display_name=_extract_chat_display_name(item, phone_normalized),
                profile_picture_url=_extract_profile_picture_url(item),
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
