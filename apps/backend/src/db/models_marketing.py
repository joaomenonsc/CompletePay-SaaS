"""
Models SQLAlchemy para o modulo Email Marketing.
Prefixo emk_ para todas as tabelas. Segue o padrao de models_crm.py:
String(36) para IDs, _uuid_str, mapped_column, DateTime(timezone=True), organization_id FK.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.session import Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


# ── Templates ────────────────────────────────────────────────────────────────


class EmkTemplate(Base):
    """Template de email marketing. Multi-tenant por organization_id."""
    __tablename__ = "emk_templates"
    __table_args__ = (
        Index("ix_emk_templates_organization_id", "organization_id"),
        Index("ix_emk_templates_category", "category"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="geral")
    subject_template: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    html_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    blocks_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    variables: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)  # ["nome_paciente", "nome_clinica"]
    is_starter: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# ── Listas & Subscribers ────────────────────────────────────────────────────


class EmkList(Base):
    """Lista de destinatarios (estatica ou dinamica). Multi-tenant."""
    __tablename__ = "emk_lists"
    __table_args__ = (
        Index("ix_emk_lists_organization_id", "organization_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    list_type: Mapped[str] = mapped_column(String(20), nullable=False, default="static")  # static, dynamic
    filter_criteria: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # para listas dinamicas
    subscriber_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    list_subscribers: Mapped[list["EmkListSubscriber"]] = relationship(
        "EmkListSubscriber", back_populates="list", cascade="all, delete-orphan"
    )


class EmkSubscriber(Base):
    """Contato de email. Pode estar vinculado a um Patient via patient_id."""
    __tablename__ = "emk_subscribers"
    __table_args__ = (
        UniqueConstraint("organization_id", "email", name="uq_emk_subscriber_org_email"),
        Index("ix_emk_subscribers_organization_id", "organization_id"),
        Index("ix_emk_subscribers_email", "email"),
        Index("ix_emk_subscribers_patient_id", "patient_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    patient_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("crm_patients.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # active, unsubscribed, bounced
    unsubscribed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    list_subscribers: Mapped[list["EmkListSubscriber"]] = relationship(
        "EmkListSubscriber", back_populates="subscriber", cascade="all, delete-orphan"
    )


class EmkListSubscriber(Base):
    """Vinculo N:N lista <-> subscriber."""
    __tablename__ = "emk_list_subscribers"
    __table_args__ = (
        UniqueConstraint("list_id", "subscriber_id", name="uq_emk_list_subscriber"),
    )

    list_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("emk_lists.id", ondelete="CASCADE"), primary_key=True
    )
    subscriber_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("emk_subscribers.id", ondelete="CASCADE"), primary_key=True
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    list: Mapped["EmkList"] = relationship("EmkList", back_populates="list_subscribers")
    subscriber: Mapped["EmkSubscriber"] = relationship("EmkSubscriber", back_populates="list_subscribers")


# ── Campanhas ────────────────────────────────────────────────────────────────


class EmkCampaign(Base):
    """Campanha de email marketing. Multi-tenant."""
    __tablename__ = "emk_campaigns"
    __table_args__ = (
        Index("ix_emk_campaigns_organization_id", "organization_id"),
        Index("ix_emk_campaigns_status", "status"),
        Index("ix_emk_campaigns_template_id", "template_id"),
        Index("ix_emk_campaigns_list_id", "list_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    template_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("emk_templates.id", ondelete="SET NULL"), nullable=True
    )
    list_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("emk_lists.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )  # draft, scheduled, sending, sent, partial, failed, cancelled
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Remetente
    from_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    from_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reply_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Contadores (atualizados via webhooks)
    total_recipients: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_sent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_delivered: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_opened: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_clicked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_bounced: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_unsubscribed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    sends: Mapped[list["EmkSend"]] = relationship(
        "EmkSend", back_populates="campaign", cascade="all, delete-orphan"
    )


# ── Envios individuais ──────────────────────────────────────────────────────


class EmkSend(Base):
    """Registro de envio individual (1 email para 1 destinatario)."""
    __tablename__ = "emk_sends"
    __table_args__ = (
        Index("ix_emk_sends_campaign_id", "campaign_id"),
        Index("ix_emk_sends_subscriber_id", "subscriber_id"),
        Index("ix_emk_sends_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    campaign_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("emk_campaigns.id", ondelete="CASCADE"), nullable=False
    )
    subscriber_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("emk_subscribers.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="queued"
    )  # queued, sent, delivered, opened, clicked, bounced, failed
    esp_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    clicked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    bounced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    campaign: Mapped["EmkCampaign"] = relationship("EmkCampaign", back_populates="sends")


# ── Eventos de webhook ──────────────────────────────────────────────────────


class EmkEvent(Base):
    """Evento de webhook do ESP (delivery, open, click, bounce, unsubscribe)."""
    __tablename__ = "emk_events"
    __table_args__ = (
        Index("ix_emk_events_send_id", "send_id"),
        Index("ix_emk_events_event_type", "event_type"),
        Index("ix_emk_events_created_at", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    send_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("emk_sends.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # delivery, open, click, bounce, unsubscribe, complaint
    event_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ── Domínios ────────────────────────────────────────────────────────────────


class EmkDomain(Base):
    """Domínio verificado para envio de emails. Multi-tenant."""
    __tablename__ = "emk_domains"
    __table_args__ = (
        UniqueConstraint("organization_id", "domain", name="uq_emk_domain_org_domain"),
        Index("ix_emk_domains_organization_id", "organization_id"),
        Index("ix_emk_domains_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    domain: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending, verified, failed
    region: Mapped[str] = mapped_column(String(30), nullable=False, default="sa-east-1")
    provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # cloudflare, route53, etc.
    click_tracking: Mapped[bool] = mapped_column(default=True, nullable=False)
    open_tracking: Mapped[bool] = mapped_column(default=False, nullable=False)
    tls_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="opportunistic"
    )  # opportunistic, enforced
    dns_records: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# ── Emails Recebidos (Inbound) ──────────────────────────────────────────────


class EmkInboundEmail(Base):
    """Emails recebidos via Webhook Inbound (ex: respostas de clientes)."""
    __tablename__ = "emk_inbound_emails"
    __table_args__ = (
        Index("ix_emk_inbound_emails_organization_id", "organization_id"),
        Index("ix_emk_inbound_emails_status", "status"),
        Index("ix_emk_inbound_emails_from_email", "from_email"),
        Index("ix_emk_inbound_emails_to_email", "to_email"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    from_email: Mapped[str] = mapped_column(String(255), nullable=False)
    from_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    text_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    html_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="unread"
    )  # unread, read, processed
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
