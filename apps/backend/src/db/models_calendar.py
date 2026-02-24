"""
Models SQLAlchemy para o modulo de Calendario e Agendamento.
Segue os mesmos padroes de src/db/models.py: String(36) para IDs,
mapped_column, DateTime(timezone=True), _uuid_str() para defaults.
"""
import enum
import uuid
from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.session import Base


def _uuid_str() -> str:
    return str(uuid.uuid4())


# ────────────────────────────────────────────────────────────────
# ENUMS
# ────────────────────────────────────────────────────────────────

class LocationType(str, enum.Enum):
    video = "video"
    in_person = "in_person"
    phone = "phone"
    custom_link = "custom_link"


class BookingStatus(str, enum.Enum):
    confirmed = "confirmed"
    pending = "pending"
    cancelled = "cancelled"
    completed = "completed"
    no_show = "no_show"


class CancelledBy(str, enum.Enum):
    host = "host"
    guest = "guest"
    system = "system"


class WebhookEvent(str, enum.Enum):
    booking_created = "booking.created"
    booking_cancelled = "booking.cancelled"
    booking_rescheduled = "booking.rescheduled"


class WorkflowTriggerType(str, enum.Enum):
    before_event = "before_event"
    after_event = "after_event"
    on_booking = "on_booking"
    on_cancellation = "on_cancellation"


class WorkflowActionType(str, enum.Enum):
    send_email = "send_email"
    send_notification = "send_notification"


# ────────────────────────────────────────────────────────────────
# EVENT TYPES
# ────────────────────────────────────────────────────────────────

class EventType(Base):
    """Tipo de evento (reuniao, consulta, atendimento)."""
    __tablename__ = "event_types"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_event_type_org_slug"),
        Index("ix_event_types_org_id", "organization_id"),
        Index("ix_event_types_user_id", "user_id"),
        Index("ix_event_types_agent_config_id", "agent_config_id"),
        Index("ix_event_types_is_active", "organization_id", "is_active"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    agent_config_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("agent_configs.id", ondelete="SET NULL"),
        nullable=True,
    )
    schedule_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("availability_schedules.id", ondelete="SET NULL"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)
    requires_confirmation: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    allow_multiple_durations: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    additional_durations: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    locations: Mapped[list["EventTypeLocation"]] = relationship(
        "EventTypeLocation",
        back_populates="event_type",
        cascade="all, delete-orphan",
    )
    limits: Mapped[Optional["EventTypeLimit"]] = relationship(
        "EventTypeLimit",
        back_populates="event_type",
        uselist=False,
        cascade="all, delete-orphan",
    )
    schedule: Mapped[Optional["AvailabilitySchedule"]] = relationship(
        "AvailabilitySchedule", back_populates="event_types"
    )
    bookings: Mapped[list["Booking"]] = relationship(
        "Booking", back_populates="event_type"
    )
    webhooks: Mapped[list["Webhook"]] = relationship(
        "Webhook", back_populates="event_type", cascade="all, delete-orphan"
    )


class EventTypeLocation(Base):
    """Locais configurados para um tipo de evento (multiplos permitidos)."""
    __tablename__ = "event_type_locations"
    __table_args__ = (
        Index("ix_event_type_locations_event_type_id", "event_type_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    event_type_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("event_types.id", ondelete="CASCADE"),
        nullable=False,
    )
    location_type: Mapped[LocationType] = mapped_column(
        Enum(LocationType, name="location_type_enum", create_constraint=True),
        nullable=False,
    )
    location_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    event_type: Mapped["EventType"] = relationship(
        "EventType", back_populates="locations"
    )


class EventTypeLimit(Base):
    """Limites e restricoes por tipo de evento (relacao 1:1)."""
    __tablename__ = "event_type_limits"
    __table_args__ = (
        Index("ix_event_type_limits_event_type_id", "event_type_id"),
        CheckConstraint("buffer_before_minutes >= 0", name="ck_buffer_before_gte_0"),
        CheckConstraint("buffer_after_minutes >= 0", name="ck_buffer_after_gte_0"),
        CheckConstraint("minimum_notice_minutes >= 0", name="ck_min_notice_gte_0"),
        CheckConstraint("max_future_days > 0", name="ck_max_future_days_gt_0"),
        CheckConstraint(
            "slot_interval_minutes IS NULL OR slot_interval_minutes > 0",
            name="ck_slot_interval_gt_0",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    event_type_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("event_types.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    buffer_before_minutes: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    buffer_after_minutes: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    minimum_notice_minutes: Mapped[int] = mapped_column(
        Integer, default=60, nullable=False
    )
    slot_interval_minutes: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    max_bookings_per_day: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    limit_to_first_slot: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    max_duration_per_day_minutes: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    max_future_days: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    frequency_limit: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    event_type: Mapped["EventType"] = relationship(
        "EventType", back_populates="limits"
    )


# ────────────────────────────────────────────────────────────────
# AVAILABILITY SCHEDULES
# ────────────────────────────────────────────────────────────────

class AvailabilitySchedule(Base):
    """Schedule de disponibilidade reutilizavel."""
    __tablename__ = "availability_schedules"
    __table_args__ = (
        Index("ix_avail_schedules_org_id", "organization_id"),
        Index("ix_avail_schedules_user_id", "user_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    timezone: Mapped[str] = mapped_column(
        String(50), nullable=False, default="America/Sao_Paulo"
    )
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    intervals: Mapped[list["AvailabilityScheduleInterval"]] = relationship(
        "AvailabilityScheduleInterval",
        back_populates="schedule",
        cascade="all, delete-orphan",
        order_by="AvailabilityScheduleInterval.day_of_week, AvailabilityScheduleInterval.start_time",
    )
    overrides: Mapped[list["AvailabilityOverride"]] = relationship(
        "AvailabilityOverride",
        back_populates="schedule",
        cascade="all, delete-orphan",
    )
    event_types: Mapped[list["EventType"]] = relationship(
        "EventType", back_populates="schedule"
    )


class AvailabilityScheduleInterval(Base):
    """
    Intervalo de disponibilidade: um bloco de tempo em um dia da semana.
    Multiplos intervalos por dia sao permitidos (ex: 09:00-12:00, 14:00-18:00).
    """
    __tablename__ = "availability_schedule_intervals"
    __table_args__ = (
        Index("ix_avail_intervals_schedule_id", "schedule_id"),
        CheckConstraint(
            "day_of_week >= 0 AND day_of_week <= 6", name="ck_day_of_week_range"
        ),
        CheckConstraint("start_time < end_time", name="ck_start_before_end"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    schedule_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("availability_schedules.id", ondelete="CASCADE"),
        nullable=False,
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    # 0=segunda, 1=terca, ..., 6=domingo (ISO 8601 weekday - 1)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    schedule: Mapped["AvailabilitySchedule"] = relationship(
        "AvailabilitySchedule", back_populates="intervals"
    )


class AvailabilityOverride(Base):
    """Override de disponibilidade para uma data especifica."""
    __tablename__ = "availability_overrides"
    __table_args__ = (
        UniqueConstraint(
            "schedule_id", "override_date", name="uq_override_schedule_date"
        ),
        Index("ix_avail_overrides_schedule_id", "schedule_id"),
        Index("ix_avail_overrides_date", "override_date"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    schedule_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("availability_schedules.id", ondelete="CASCADE"),
        nullable=False,
    )
    override_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False)
    start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    schedule: Mapped["AvailabilitySchedule"] = relationship(
        "AvailabilitySchedule", back_populates="overrides"
    )


# ────────────────────────────────────────────────────────────────
# BOOKINGS
# ────────────────────────────────────────────────────────────────

class Booking(Base):
    """Reserva de agendamento."""
    __tablename__ = "bookings"
    __table_args__ = (
        Index("ix_bookings_org_id", "organization_id"),
        Index("ix_bookings_event_type_id", "event_type_id"),
        Index("ix_bookings_host_user_id", "host_user_id"),
        Index("ix_bookings_host_agent_id", "host_agent_config_id"),
        Index("ix_bookings_start_time", "start_time"),
        Index("ix_bookings_status", "status"),
        Index("ix_bookings_guest_email", "guest_email"),
        Index("ix_bookings_uid", "uid"),
        Index(
            "ix_bookings_host_time_status",
            "organization_id",
            "host_user_id",
            "start_time",
            "end_time",
            "status",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    uid: Mapped[str] = mapped_column(
        String(36), unique=True, nullable=False, default=_uuid_str
    )
    organization_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("event_types.id", ondelete="CASCADE"),
        nullable=False,
    )
    host_user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    host_agent_config_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("agent_configs.id", ondelete="SET NULL"),
        nullable=True,
    )

    guest_name: Mapped[str] = mapped_column(String(255), nullable=False)
    guest_email: Mapped[str] = mapped_column(String(255), nullable=False)
    guest_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False)

    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status_enum", create_constraint=True),
        default=BookingStatus.confirmed,
        nullable=False,
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cancelled_by: Mapped[Optional[CancelledBy]] = mapped_column(
        Enum(CancelledBy, name="cancelled_by_enum", create_constraint=True),
        nullable=True,
    )
    cancel_token: Mapped[str] = mapped_column(
        String(36), nullable=False, default=_uuid_str
    )
    meeting_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rescheduled_from: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    event_type: Mapped["EventType"] = relationship(
        "EventType", back_populates="bookings"
    )
    attendees: Mapped[list["BookingAttendee"]] = relationship(
        "BookingAttendee",
        back_populates="booking",
        cascade="all, delete-orphan",
    )


class BookingAttendee(Base):
    """Participantes adicionais de um booking."""
    __tablename__ = "booking_attendees"
    __table_args__ = (
        Index("ix_booking_attendees_booking_id", "booking_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    booking_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    booking: Mapped["Booking"] = relationship("Booking", back_populates="attendees")


# ────────────────────────────────────────────────────────────────
# WORKFLOWS
# ────────────────────────────────────────────────────────────────

class Workflow(Base):
    """Workflow de automacao vinculado a eventos de calendario."""
    __tablename__ = "workflows"
    __table_args__ = (
        Index("ix_workflows_org_id", "organization_id"),
        Index("ix_workflows_event_type_id", "event_type_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("event_types.id", ondelete="CASCADE"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    steps: Mapped[list["WorkflowStep"]] = relationship(
        "WorkflowStep",
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowStep.step_order",
    )


class WorkflowStep(Base):
    """Passo individual de um workflow."""
    __tablename__ = "workflow_steps"
    __table_args__ = (
        Index("ix_workflow_steps_workflow_id", "workflow_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    workflow_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
    )
    trigger_type: Mapped[WorkflowTriggerType] = mapped_column(
        Enum(
            WorkflowTriggerType,
            name="workflow_trigger_type_enum",
            create_constraint=True,
        ),
        nullable=False,
    )
    trigger_offset_minutes: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    action_type: Mapped[WorkflowActionType] = mapped_column(
        Enum(
            WorkflowActionType,
            name="workflow_action_type_enum",
            create_constraint=True,
        ),
        nullable=False,
    )
    action_config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="steps")


# ────────────────────────────────────────────────────────────────
# WEBHOOKS
# ────────────────────────────────────────────────────────────────

class Webhook(Base):
    """Webhook configurado para um tipo de evento."""
    __tablename__ = "webhooks"
    __table_args__ = (
        Index("ix_webhooks_org_id", "organization_id"),
        Index("ix_webhooks_event_type_id", "event_type_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("event_types.id", ondelete="CASCADE"),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    events: Mapped[list] = mapped_column(JSONB, nullable=False)
    secret: Mapped[str] = mapped_column(
        String(255), nullable=False, default=_uuid_str
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    event_type: Mapped["EventType"] = relationship(
        "EventType", back_populates="webhooks"
    )
    deliveries: Mapped[list["WebhookDelivery"]] = relationship(
        "WebhookDelivery",
        back_populates="webhook",
        cascade="all, delete-orphan",
    )


class WebhookDelivery(Base):
    """Registro de tentativa de entrega de webhook."""
    __tablename__ = "webhook_deliveries"
    __table_args__ = (
        Index("ix_webhook_deliveries_webhook_id", "webhook_id"),
        Index("ix_webhook_deliveries_booking_id", "booking_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    webhook_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("webhooks.id", ondelete="CASCADE"),
        nullable=False,
    )
    booking_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
    )
    event: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    response_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)

    webhook: Mapped["Webhook"] = relationship("Webhook", back_populates="deliveries")


# ────────────────────────────────────────────────────────────────
# EMAIL LOGS
# ────────────────────────────────────────────────────────────────

class EmailLog(Base):
    """Log de envio de emails transacionais."""
    __tablename__ = "email_logs"
    __table_args__ = (
        Index("ix_email_logs_booking_id", "booking_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    booking_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
    )
    template_type: Mapped[str] = mapped_column(String(50), nullable=False)
    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
