"""
Modelos SQLAlchemy para o módulo WhatsApp.
Padrão: String(36) para IDs, mapped_column, DateTime(timezone=True), _uuid_str() para defaults.
Referência: src/db/models_crm.py
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Index, Integer, SmallInteger,
    String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.db.session import Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Enums (strings — evita depender de Enum do Python para simplificar migrações)
# ---------------------------------------------------------------------------

class AccountStatus:
    PENDING = "pending"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class AccountProvider:
    EVOLUTION = "evolution"
    WAHA = "waha"
    META = "meta"


class ConversationStatus:
    OPEN = "open"
    RESOLVED = "resolved"
    ARCHIVED = "archived"
    SPAM = "spam"


class MessageDirection:
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageType:
    TEXT = "text"
    AUDIO = "audio"
    IMAGE = "image"
    DOCUMENT = "document"
    TEMPLATE = "template"
    INTERACTIVE = "interactive"
    STICKER = "sticker"
    LOCATION = "location"


class MessageStatus:
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class TemplateStatus:
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class CampaignStatus:
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# 1. WhatsAppAccount — conta WhatsApp (uma por número de telefone)
# ---------------------------------------------------------------------------

class WhatsAppAccount(Base):
    """
    Conta WhatsApp conectada à organização.
    A API key é armazenada criptografada (AES-256-GCM via encryption.py).
    """
    __tablename__ = "whatsapp_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    # Identificação da conta
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)
    # Número E.164 do número WhatsApp Business (ex: +5511999990001)

    # Provider
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default=AccountProvider.EVOLUTION)
    # "evolution" | "waha" | "meta"

    instance_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    # Nome da instância no provider (ex: "clinica-abc" no Evolution)

    api_base_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    # URL base da instância do provider (ex: https://evolution.meudominio.com)

    api_key_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # API key criptografada com AES-256-GCM. NUNCA expor em responses.

    webhook_secret_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    # SHA-256 do webhook secret (para HMAC validation). NUNCA expor em responses.

    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=AccountStatus.DISCONNECTED, index=True
    )
    # "pending" | "connected" | "disconnected" | "error"

    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Conta padrão da organização (usada quando não especificada)

    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # Dados extras do provider (ex: QR code base64, session info)

    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "phone_number",
                         name="uq_whatsapp_accounts_org_phone"),
        Index("ix_wa_accounts_org_status", "organization_id", "status"),
    )


# ---------------------------------------------------------------------------
# 2. WhatsAppContact — contato (sem account_id — pertence à org, não à conta)
# ---------------------------------------------------------------------------

class WhatsAppContact(Base):
    """
    Contato WhatsApp. Nunca duplicado: unique em (organization_id, phone_normalized).
    Sem account_id: um contato pertence à organização, não a uma conta específica.
    A conta WhatsApp aparece na whatsapp_conversations.
    Pode ser vinculado a Patient do CRM via patient_id (nullable).
    """
    __tablename__ = "whatsapp_contacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    # Número normalizado (apenas dígitos): "5511999999999"
    phone_normalized: Mapped[str] = mapped_column(String(20), nullable=False)
    # Número E.164 (com +): "+5511999999999"
    phone_e164: Mapped[str] = mapped_column(String(20), nullable=False)
    # Formato exibição: "(11) 99999-9999"
    phone_display: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    display_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    profile_picture_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    # Vinculação CRM (opcional — preenchida por auto-link quando telefone coincide)
    patient_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("crm_patients.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Tags (JSONB array: ["lead", "vip", "follow-up"])
    tags: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)

    # Opt-out LGPD
    opted_out: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    opted_out_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "phone_normalized",
                         name="uq_whatsapp_contacts_org_phone"),
        Index("ix_whatsapp_contacts_org_phone", "organization_id", "phone_normalized"),
        Index("ix_whatsapp_contacts_patient", "patient_id"),
    )


# ---------------------------------------------------------------------------
# 3. WhatsAppConversation — thread de conversa
# ---------------------------------------------------------------------------

class WhatsAppConversation(Base):
    """
    Thread de conversa entre a organização e um contato.
    Uma conversa = um número ↔ uma conta WhatsApp.
    """
    __tablename__ = "whatsapp_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("whatsapp_accounts.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    contact_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("whatsapp_contacts.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    # Estado
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=ConversationStatus.OPEN, index=True
    )
    # C2-FIX: removido is_unread (boolean redundante). Usar unread_count > 0 para derivar.
    unread_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Atribuição — user_id do atendente (UserOrganization.user_id)
    assigned_to: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)

    # SLA — C4-FIX: usar timestamp bruto, não boolean calculado.
    # SLA breach = NOW() > sla_deadline AND status == 'open'. Calcular em query/service.
    sla_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    first_response_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Para cálculo de TMA (Tempo Médio de Atendimento)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Última mensagem (desnormalizado para listagem rápida de inbox)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    last_message_preview: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    # Dados extras
    tags: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # IA
    ai_sentiment: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    # "positive" | "neutral" | "negative"
    ai_intent: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    ai_lead_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # C3-FIX: is_deleted necessário para índice partial de inbox
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_wa_conversations_org_status", "organization_id", "status"),
        Index("ix_wa_conversations_org_unread", "organization_id", "unread_count"),
        Index("ix_wa_conversations_last_msg", "organization_id", "last_message_at"),
        Index("ix_wa_conversations_assigned", "organization_id", "assigned_to"),
    )


# ---------------------------------------------------------------------------
# 4. WhatsAppMessage — mensagem individual
# ---------------------------------------------------------------------------

class WhatsAppMessage(Base):
    """Mensagem individual em uma conversa WhatsApp."""
    __tablename__ = "whatsapp_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("whatsapp_conversations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    contact_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("whatsapp_contacts.id", ondelete="SET NULL"),
        nullable=True
    )

    # C5-FIX: external_message_id NOT NULL — garante idempotência do webhook.
    # Para mensagens outbound antes do ACK do provider: usar UUID interno temporário f"pending:{id}"
    external_message_id: Mapped[str] = mapped_column(String(256), nullable=False)

    direction: Mapped[str] = mapped_column(String(16), nullable=False)
    # "inbound" | "outbound"

    message_type: Mapped[str] = mapped_column(String(32), nullable=False, default=MessageType.TEXT)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=MessageStatus.PENDING, index=True
    )

    # Conteúdo (com mascaramento de PII em logs — nunca logar body_text direto)
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    media_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    media_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    media_filename: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    # Template usado (se for mensagem de template)
    template_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("whatsapp_templates.id", ondelete="SET NULL"),
        nullable=True
    )
    template_variables: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Metadata do provider
    provider_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Remetente: null = mensagem do contato, preenchido = enviada por atendente
    sender_user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Detalhes de falha
    error_message: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    # Timestamps de status
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "external_message_id",
                         name="uq_wa_messages_org_external_id"),
        Index("ix_wa_messages_conversation", "conversation_id", "created_at"),
        Index("ix_wa_messages_org_status", "organization_id", "status"),
        Index("ix_wa_messages_external_id", "external_message_id"),
    )

    @property
    def client_pending_id(self) -> Optional[str]:
        metadata = self.provider_metadata if isinstance(self.provider_metadata, dict) else {}
        raw_value = metadata.get("client_pending_id")
        if isinstance(raw_value, str):
            normalized = raw_value.strip()
            if normalized:
                return normalized
        external_id = (self.external_message_id or "").strip()
        if external_id.startswith("pending:"):
            return external_id
        return None


# ---------------------------------------------------------------------------
# 5. WhatsAppTemplate — template de mensagem
# ---------------------------------------------------------------------------

class WhatsAppTemplate(Base):
    """Template de mensagem WhatsApp (compatível com Meta BSP)."""
    __tablename__ = "whatsapp_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    # I10-FIX: account_id necessário para providers como Meta BSP onde templates são
    # aprovados por número de telefone específico (by-account), não apenas por org.
    # nullable=True para Evolution/WAHA onde templates são globais por org.
    account_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("whatsapp_accounts.id", ondelete="SET NULL"),
        nullable=True, index=True
    )

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    # "MARKETING" | "UTILITY" | "AUTHENTICATION" | "transacional" (interno)
    language: Mapped[str] = mapped_column(String(8), nullable=False, default="pt_BR")
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=TemplateStatus.DRAFT, index=True
    )

    # Conteúdo estruturado
    header_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    # "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT"
    header_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_text: Mapped[str] = mapped_column(Text, nullable=False)
    footer_text: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)

    # Variáveis permitidas (ex: ["patient_name", "appointment_date"])
    variables: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)

    # Botões CTA (JSONB: lista de {type, text, url/phone/payload})
    buttons: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)

    # Versão e histórico
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    parent_template_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("whatsapp_templates.id", ondelete="SET NULL"), nullable=True
    )

    # External (provider ID após aprovação)
    external_template_id: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    rejected_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("organization_id", "name", "version",
                         name="uq_wa_templates_org_name_version"),
        Index("ix_wa_templates_org_status", "organization_id", "status"),
    )


# ---------------------------------------------------------------------------
# 6. WhatsAppCampaign — campanha de disparo em massa
# ---------------------------------------------------------------------------

class WhatsAppCampaign(Base):
    """Campanha de envio em massa via WhatsApp."""
    __tablename__ = "whatsapp_campaigns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("whatsapp_accounts.id", ondelete="RESTRICT"),
        nullable=False
    )

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=CampaignStatus.DRAFT, index=True
    )

    template_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("whatsapp_templates.id", ondelete="RESTRICT"),
        nullable=False
    )
    # Variáveis globais da campanha (sobrescritas por variáveis individuais do recipient)
    template_variables_default: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Segmentação (JSON com filtros: tags, cidade, status_agendamento etc.)
    segment_filter: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Agendamento
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # I9-FIX: renomeado de finished_at para completed_at (alinhado com status COMPLETED e DDL)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Rate limiting — 30 msg/min é conservador para não ser banido
    messages_per_minute: Mapped[int] = mapped_column(Integer, default=30, nullable=False)

    # Métricas (desnormalizadas para leitura rápida)
    total_recipients: Mapped[int] = mapped_column(Integer, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    delivered_count: Mapped[int] = mapped_column(Integer, default=0)
    read_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    # C6-FIX: removido reply_count — campo inexistente no DDL — Fase 2
    # I7-FIX: removidos campos A/B test — PRD classifica como COULD (Fase 2)
    # Fase 2: is_ab_test, ab_variant, ab_split_percentage

    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_wa_campaigns_org_status", "organization_id", "status"),
        Index("ix_wa_campaigns_scheduled", "scheduled_at"),
    )


# ---------------------------------------------------------------------------
# 7. WhatsAppCampaignRecipient — destinatário de campanha
# ---------------------------------------------------------------------------

class WhatsAppCampaignRecipient(Base):
    """Destinatário individual de uma campanha WhatsApp."""
    __tablename__ = "whatsapp_campaign_recipients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False
    )
    campaign_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("whatsapp_campaigns.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    contact_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("whatsapp_contacts.id", ondelete="CASCADE"),
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=MessageStatus.PENDING, index=True
    )
    # "pending" | "sent" | "delivered" | "read" | "failed" | "skipped"

    # Variáveis específicas do recipient (sobrescrevem o default da campanha)
    template_variables: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Rastreamento
    message_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("whatsapp_messages.id", ondelete="SET NULL"), nullable=True
    )
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    __table_args__ = (
        UniqueConstraint("campaign_id", "contact_id", name="uq_wa_campaign_contact"),
        Index("ix_wa_campaign_recipients_status", "campaign_id", "status"),
    )


# ---------------------------------------------------------------------------
# 8. WhatsAppAutomationTrigger — vínculo com módulo Automations
# ---------------------------------------------------------------------------

class WhatsAppAutomationTrigger(Base):
    """
    Trigger que conecta eventos WhatsApp ao Builder de Automações.
    Referencia um AutomationWorkflow publicado pelo módulo Automations.
    """
    __tablename__ = "whatsapp_automation_triggers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("whatsapp_accounts.id", ondelete="CASCADE"),
        nullable=False
    )

    # I4-FIX: campo name presente no DDL e na WA-8.1 (exibição na UI)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # I4-FIX: renomeado trigger_event → event_type (alinhado com DDL e story WA-1.3 AC3)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    # "message_received" | "keyword_matched" | "no_response" | "status_changed"

    # Condições do trigger (JSONB)
    # Ex: {"keyword": "agendar"} | {"no_response_hours": 24} | {"status": "resolved"}
    conditions: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Referência ao workflow do módulo Automations
    # FK soft: não usar ForeignKey real para evitar acoplamento entre módulos (ADR-WA-06)
    workflow_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Ordem de avaliação quando múltiplos triggers ativos na mesma org

    # I5-FIX: campos de auditoria de disparo presentes no DDL
    last_triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # last_error: preenchido pelo service quando workflow_id não existe ou falha

    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_wa_triggers_org_event", "organization_id", "event_type"),
        Index("ix_wa_triggers_org_active", "organization_id", "account_id", "is_active"),
    )
