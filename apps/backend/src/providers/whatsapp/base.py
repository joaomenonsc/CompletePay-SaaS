"""
Interface abstrata para providers WhatsApp.
Qualquer novo provider deve implementar esta ABC para ser plugável ao factory.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Dataclasses de transporte — agnósticas ao provider
# ---------------------------------------------------------------------------

@dataclass
class SendMessageResult:
    """Resultado de um envio de mensagem."""
    external_message_id: str
    # ID do provider (ex: Evolution message ID, Meta WAMID)
    status: str
    # "sent" | "queued" | "failed"
    provider_metadata: Optional[dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class InboundMessage:
    """Mensagem inbound recebida pelo provider."""
    external_message_id: str
    phone_normalized: str       # telefone remetente (apenas dígitos)
    phone_e164: str             # telefone remetente E.164 (com +)
    direction: str              # sempre "inbound"
    message_type: str           # "text" | "audio" | "image" | "document" | etc.
    body_text: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    media_filename: Optional[str] = None
    received_at: Optional[str] = None      # ISO 8601
    display_name: Optional[str] = None    # Nome do contato no WhatsApp
    provider_metadata: Optional[dict[str, Any]] = None


@dataclass
class StatusUpdate:
    """Atualização de status de mensagem outbound."""
    external_message_id: str
    status: str                 # "delivered" | "read" | "failed"
    timestamp: Optional[str] = None     # ISO 8601
    error: Optional[str] = None
    provider_metadata: Optional[dict[str, Any]] = None


@dataclass
class WebhookPayload:
    """
    Payload normalizado retornado por parse_webhook().
    Contém uma lista de eventos recebidos no payload bruto.
    """
    account_id: str
    event_type: str             # "message.received" | "message.delivered" | "message.read" | "message.failed" | "unknown"
    inbound_messages: list[InboundMessage] = field(default_factory=list)
    status_updates: list[StatusUpdate] = field(default_factory=list)
    raw: Optional[dict[str, Any]] = None  # payload original (para debug)


# ---------------------------------------------------------------------------
# ABC do provider
# ---------------------------------------------------------------------------

class WhatsAppProviderInterface(ABC):
    """
    Interface abstrata para providers WhatsApp.
    Implementações: EvolutionAPIProvider, WAHAProvider, MetaOfficialProvider.
    """

    @abstractmethod
    def send_text(
        self,
        to_phone: str,
        text: str,
        *,
        instance: Optional[str] = None,
    ) -> SendMessageResult:
        """Envia uma mensagem de texto simples."""

    @abstractmethod
    def send_template(
        self,
        to_phone: str,
        template_name: str,
        language_code: str,
        variables: Optional[dict[str, Any]] = None,
        *,
        instance: Optional[str] = None,
    ) -> SendMessageResult:
        """Envia uma mensagem de template aprovado."""

    @abstractmethod
    def send_media(
        self,
        to_phone: str,
        media_url: str,
        media_type: str,
        caption: Optional[str] = None,
        *,
        instance: Optional[str] = None,
    ) -> SendMessageResult:
        """Envia mídia (imagem, áudio, documento)."""

    @abstractmethod
    def parse_webhook(
        self,
        account_id: str,
        raw_payload: dict[str, Any],
    ) -> list[WebhookPayload]:
        """
        Parseia o payload bruto do provider e retorna lista de WebhookPayload normalizados.
        Um payload pode conter múltiplos eventos (ex: batch no Evolution).
        """

    @abstractmethod
    def get_qrcode(self, instance: str) -> Optional[str]:
        """Retorna QR Code base64 para conectar número (se suportado pelo provider)."""

    @abstractmethod
    def health(self) -> dict[str, Any]:
        """Verifica conectividade e status da instância."""
