"""Schemas Pydantic v2 para a API do módulo WhatsApp."""
from datetime import datetime
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class PaginatedResponse(BaseModel, Generic[T]):
    """Resposta paginada genérica: {"items": [...], "total": N}."""
    items: list[T]
    total: int
    limit: int = 50
    offset: int = 0


# ---------------------------------------------------------------------------
# WhatsAppAccount
# ---------------------------------------------------------------------------

class WhatsAppAccountCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=255)
    phone_number: str = Field(..., min_length=8, max_length=20)
    provider: str = Field(default="evolution", pattern="^(evolution|waha|meta)$")
    instance_name: Optional[str] = Field(None, max_length=128)
    api_base_url: Optional[str] = Field(None, max_length=512)
    api_key: Optional[str] = Field(None, max_length=512)
    # Enviado em plain text, criptografado no service antes de persistir
    webhook_secret: Optional[str] = Field(None, max_length=256)
    # Enviado em plain text, hashado (SHA-256) antes de persistir
    is_default: bool = False

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        import re
        digits = re.sub(r"\D", "", v)
        if len(digits) < 10 or len(digits) > 15:
            raise ValueError("Número de telefone inválido.")
        return v.strip()


class WhatsAppAccountUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=255)
    instance_name: Optional[str] = Field(None, max_length=128)
    api_base_url: Optional[str] = Field(None, max_length=512)
    api_key: Optional[str] = Field(None, max_length=512)
    webhook_secret: Optional[str] = Field(None, max_length=256)
    is_default: Optional[bool] = None


class WhatsAppAccountResponse(BaseModel):
    id: str
    organization_id: str
    display_name: str
    phone_number: str
    provider: str
    instance_name: Optional[str] = None
    api_base_url: Optional[str] = None
    # NUNCA retornar api_key_encrypted ou webhook_secret_hash
    status: str
    is_default: bool
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WhatsAppAccountListResponse(BaseModel):
    items: list[WhatsAppAccountResponse]
    total: int
    limit: int
    offset: int


class QRCodeResponse(BaseModel):
    """Resposta do endpoint GET /accounts/{id}/qrcode."""
    account_id: str
    qrcode_base64: Optional[str] = None
    status: str  # "pending" | "available" | "connected"
    message: Optional[str] = None


# ---------------------------------------------------------------------------
# WhatsAppContact
# ---------------------------------------------------------------------------

class WhatsAppContactResponse(BaseModel):
    id: str
    organization_id: str
    phone_normalized: str
    phone_e164: str
    phone_display: Optional[str] = None
    display_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    patient_id: Optional[str] = None
    tags: Optional[list[str]] = None
    opted_out: bool
    opted_out_at: Optional[datetime] = None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# WhatsAppConversation
# ---------------------------------------------------------------------------

class ConversationUpdateSchema(BaseModel):
    """PATCH /conversations/{id} — aceita status, assigned_to, tags."""
    status: Optional[str] = Field(
        None, pattern="^(open|resolved|archived|spam)$"
    )
    assigned_to: Optional[str] = Field(None, max_length=36)
    tags: Optional[list[str]] = None
    sla_deadline: Optional[datetime] = None


class WhatsAppConversationResponse(BaseModel):
    id: str
    organization_id: str
    account_id: str
    contact_id: str
    status: str
    unread_count: int
    assigned_to: Optional[str] = None
    sla_deadline: Optional[datetime] = None
    first_response_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None
    last_message_preview: Optional[str] = None
    tags: Optional[list[str]] = None
    ai_sentiment: Optional[str] = None
    ai_intent: Optional[str] = None
    ai_lead_score: Optional[int] = None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    # Dados desnormalizados do contact (join opcional)
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class WhatsAppConversationListResponse(BaseModel):
    items: list[WhatsAppConversationResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# WhatsAppMessage
# ---------------------------------------------------------------------------

class MessageSendTextSchema(BaseModel):
    """POST /conversations/{id}/messages/text"""
    body_text: str = Field(..., min_length=1, max_length=4096)


class MessageSendTemplateSchema(BaseModel):
    """POST /conversations/{id}/messages/template"""
    template_id: str = Field(..., min_length=1, max_length=36)
    variables: Optional[dict[str, Any]] = None


class WhatsAppMessageResponse(BaseModel):
    id: str
    organization_id: str
    conversation_id: str
    contact_id: Optional[str] = None
    external_message_id: str
    direction: str
    message_type: str
    status: str
    body_text: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    media_filename: Optional[str] = None
    template_id: Optional[str] = None
    template_variables: Optional[dict[str, Any]] = None
    sender_user_id: Optional[str] = None
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WhatsAppMessageListResponse(BaseModel):
    items: list[WhatsAppMessageResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# WhatsAppTemplate
# ---------------------------------------------------------------------------

class WhatsAppTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    category: str = Field(..., max_length=64)
    language: str = Field(default="pt_BR", max_length=8)
    account_id: Optional[str] = Field(None, max_length=36)
    header_type: Optional[str] = Field(None, pattern="^(TEXT|IMAGE|VIDEO|DOCUMENT)$")
    header_content: Optional[str] = None
    body_text: str = Field(..., min_length=1)
    footer_text: Optional[str] = Field(None, max_length=60)
    variables: Optional[list[str]] = None
    buttons: Optional[list[dict[str, Any]]] = None


class WhatsAppTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    category: Optional[str] = Field(None, max_length=64)
    language: Optional[str] = Field(None, max_length=8)
    header_type: Optional[str] = Field(None, pattern="^(TEXT|IMAGE|VIDEO|DOCUMENT)$")
    header_content: Optional[str] = None
    body_text: Optional[str] = Field(None, min_length=1)
    footer_text: Optional[str] = Field(None, max_length=60)
    variables: Optional[list[str]] = None
    buttons: Optional[list[dict[str, Any]]] = None


class WhatsAppTemplateResponse(BaseModel):
    id: str
    organization_id: str
    account_id: Optional[str] = None
    name: str
    category: str
    language: str
    status: str
    header_type: Optional[str] = None
    header_content: Optional[str] = None
    body_text: str
    footer_text: Optional[str] = None
    variables: Optional[list[str]] = None
    buttons: Optional[list[dict[str, Any]]] = None
    version: int
    parent_template_id: Optional[str] = None
    external_template_id: Optional[str] = None
    rejected_reason: Optional[str] = None
    is_deleted: bool
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WhatsAppTemplateListResponse(BaseModel):
    items: list[WhatsAppTemplateResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# WhatsAppCampaign
# ---------------------------------------------------------------------------

class WhatsAppCampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    account_id: str = Field(..., min_length=1, max_length=36)
    template_id: str = Field(..., min_length=1, max_length=36)
    template_variables_default: Optional[dict[str, Any]] = None
    segment_filter: Optional[dict[str, Any]] = None
    scheduled_at: Optional[datetime] = None
    messages_per_minute: int = Field(default=30, ge=1, le=60)


class WhatsAppCampaignUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    template_id: Optional[str] = Field(None, max_length=36)
    template_variables_default: Optional[dict[str, Any]] = None
    segment_filter: Optional[dict[str, Any]] = None
    scheduled_at: Optional[datetime] = None
    messages_per_minute: Optional[int] = Field(None, ge=1, le=60)


class WhatsAppCampaignResponse(BaseModel):
    id: str
    organization_id: str
    account_id: str
    name: str
    status: str
    template_id: str
    template_variables_default: Optional[dict[str, Any]] = None
    segment_filter: Optional[dict[str, Any]] = None
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    messages_per_minute: int
    total_recipients: int
    sent_count: int
    delivered_count: int
    read_count: int
    failed_count: int
    is_deleted: bool
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WhatsAppCampaignListResponse(BaseModel):
    items: list[WhatsAppCampaignResponse]
    total: int
    limit: int
    offset: int


class CampaignProgressResponse(BaseModel):
    campaign_id: str
    status: str
    total_recipients: int
    sent_count: int
    delivered_count: int
    read_count: int
    failed_count: int
    pending_count: int
    completion_percent: float
    estimated_finish_at: Optional[datetime] = None


class PreviewRecipientsResponse(BaseModel):
    total: int
    sample: list[dict[str, Any]]  # lista de {contact_id, phone, name}
    opted_out_excluded: int


# ---------------------------------------------------------------------------
# WhatsAppCampaignRecipient
# ---------------------------------------------------------------------------

class WhatsAppCampaignRecipientResponse(BaseModel):
    id: str
    campaign_id: str
    contact_id: str
    status: str
    template_variables: Optional[dict[str, Any]] = None
    message_id: Optional[str] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# WhatsAppAutomationTrigger
# ---------------------------------------------------------------------------

class WhatsAppAutomationTriggerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    account_id: str = Field(..., min_length=1, max_length=36)
    event_type: str = Field(
        ..., pattern="^(message_received|keyword_matched|no_response|status_changed)$"
    )
    conditions: Optional[dict[str, Any]] = None
    workflow_id: str = Field(..., min_length=1, max_length=36)
    is_active: bool = True
    priority: int = Field(default=0, ge=0, le=100)


class WhatsAppAutomationTriggerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    event_type: Optional[str] = Field(
        None, pattern="^(message_received|keyword_matched|no_response|status_changed)$"
    )
    conditions: Optional[dict[str, Any]] = None
    workflow_id: Optional[str] = Field(None, max_length=36)
    is_active: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=0, le=100)


class WhatsAppAutomationTriggerResponse(BaseModel):
    id: str
    organization_id: str
    account_id: str
    name: str
    event_type: str
    conditions: Optional[dict[str, Any]] = None
    workflow_id: str
    is_active: bool
    priority: int
    last_triggered_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WhatsAppAutomationTriggerListResponse(BaseModel):
    items: list[WhatsAppAutomationTriggerResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Webhook — Payload do provider (endpoint público)
# ---------------------------------------------------------------------------

class WebhookPayloadSchema(BaseModel):
    """
    Payload genérico recebido pelo endpoint público /whatsapp/webhook/{account_id}.
    O conteúdo real varia por provider (Evolution/WAHA/Meta); o provider adapter
    é responsável por parsear o body raw antes de chamar process_webhook_event().
    """
    event: Optional[str] = None
    data: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Métricas
# ---------------------------------------------------------------------------

class WhatsAppMetricsResponse(BaseModel):
    """GET /metrics/overview"""
    period: str
    total_conversations: int
    open_conversations: int
    resolved_conversations: int
    new_contacts: int
    messages_sent: int
    messages_received: int
    avg_response_time_seconds: Optional[float] = None
    sla_breached_count: int
    opt_out_count: int
    campaign_stats: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# AI Copilot
# ---------------------------------------------------------------------------

class AISuggestReplyResponse(BaseModel):
    conversation_id: str
    suggested_reply: Optional[str] = None
    available: bool
    # False quando AI não está configurada — fallback gracioso sem erro


class AISummarizeResponse(BaseModel):
    conversation_id: str
    summary: Optional[str] = None
    available: bool
