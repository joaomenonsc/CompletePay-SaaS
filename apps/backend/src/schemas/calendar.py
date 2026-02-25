"""Schemas Pydantic para API de Calendario (request/response)."""
from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ────────────────────────────────────────────────────────────────
# EVENT TYPES
# ────────────────────────────────────────────────────────────────

class LocationCreate(BaseModel):
    location_type: str = Field(
        ..., pattern="^(video|in_person|phone|custom_link)$"
    )
    location_value: Optional[str] = None
    position: int = 0


class EventTypeCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    slug: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    duration_minutes: int = Field(..., gt=0, le=480)
    is_active: bool = True
    color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    requires_confirmation: bool = False
    allow_multiple_durations: bool = False
    additional_durations: Optional[list[int]] = None
    locations: list[LocationCreate] = Field(default_factory=list)
    schedule_id: Optional[str] = None
    agent_config_id: Optional[str] = None

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        reserved = {
            "admin", "api", "settings", "dashboard", "login", "register"
        }
        if v.lower() in reserved:
            raise ValueError(f"Slug '{v}' e reservado.")
        return v.lower()


class EventTypeUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    slug: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    duration_minutes: Optional[int] = Field(None, gt=0, le=480)
    is_active: Optional[bool] = None
    color: Optional[str] = Field(None, pattern="^#[0-9a-fA-F]{6}$")
    requires_confirmation: Optional[bool] = None
    allow_multiple_durations: Optional[bool] = None
    additional_durations: Optional[list[int]] = None
    locations: Optional[list[LocationCreate]] = None
    schedule_id: Optional[str] = None
    agent_config_id: Optional[str] = None


class LocationResponse(BaseModel):
    id: str
    location_type: str
    location_value: Optional[str] = None
    position: int

    model_config = {"from_attributes": True}


class EventTypeResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    slug: str
    duration_minutes: int
    is_active: bool
    color: Optional[str] = None
    requires_confirmation: bool
    allow_multiple_durations: bool
    additional_durations: Optional[list[int]] = None
    locations: list[LocationResponse] = []
    schedule_id: Optional[str] = None
    agent_config_id: Optional[str] = None
    user_id: Optional[str] = None
    createdAt: str
    updatedAt: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row) -> "EventTypeResponse":
        return cls(
            id=row.id,
            title=row.title,
            description=row.description,
            slug=row.slug,
            duration_minutes=row.duration_minutes,
            is_active=row.is_active,
            color=row.color,
            requires_confirmation=row.requires_confirmation,
            allow_multiple_durations=row.allow_multiple_durations,
            additional_durations=row.additional_durations,
            locations=[
                LocationResponse.model_validate(loc)
                for loc in (getattr(row, "locations") or [])
            ],
            schedule_id=row.schedule_id,
            agent_config_id=row.agent_config_id,
            user_id=row.user_id,
            createdAt=(
                row.created_at.isoformat() if row.created_at else ""
            ),
            updatedAt=(
                row.updated_at.isoformat() if row.updated_at else ""
            ),
        )


# ────────────────────────────────────────────────────────────────
# EVENT TYPE LIMITS
# ────────────────────────────────────────────────────────────────

class FrequencyLimit(BaseModel):
    period: str = Field(..., pattern="^(week|month)$")
    max: int = Field(..., gt=0)


class EventTypeLimitUpsert(BaseModel):
    buffer_before_minutes: int = Field(default=0, ge=0)
    buffer_after_minutes: int = Field(default=0, ge=0)
    minimum_notice_minutes: int = Field(default=60, ge=0)
    slot_interval_minutes: Optional[int] = Field(None, gt=0)
    max_bookings_per_day: Optional[int] = Field(None, gt=0)
    limit_to_first_slot: bool = False
    max_duration_per_day_minutes: Optional[int] = Field(None, gt=0)
    max_future_days: int = Field(default=60, gt=0)
    frequency_limit: Optional[FrequencyLimit] = None


class EventTypeLimitResponse(BaseModel):
    id: str
    event_type_id: str
    buffer_before_minutes: int
    buffer_after_minutes: int
    minimum_notice_minutes: int
    slot_interval_minutes: Optional[int] = None
    max_bookings_per_day: Optional[int] = None
    limit_to_first_slot: bool
    max_duration_per_day_minutes: Optional[int] = None
    max_future_days: int
    frequency_limit: Optional[FrequencyLimit] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row) -> "EventTypeLimitResponse":
        freq = None
        if getattr(row, "frequency_limit", None):
            freq = FrequencyLimit(**row.frequency_limit)
        return cls(
            id=row.id,
            event_type_id=row.event_type_id,
            buffer_before_minutes=row.buffer_before_minutes,
            buffer_after_minutes=row.buffer_after_minutes,
            minimum_notice_minutes=row.minimum_notice_minutes,
            slot_interval_minutes=row.slot_interval_minutes,
            max_bookings_per_day=row.max_bookings_per_day,
            limit_to_first_slot=row.limit_to_first_slot,
            max_duration_per_day_minutes=row.max_duration_per_day_minutes,
            max_future_days=row.max_future_days,
            frequency_limit=freq,
        )


# ────────────────────────────────────────────────────────────────
# AVAILABILITY SCHEDULES
# ────────────────────────────────────────────────────────────────

class IntervalCreate(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    end_time: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$")

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, v: str, info) -> str:
        start = info.data.get("start_time")
        if start and v <= start:
            raise ValueError("end_time deve ser posterior a start_time.")
        return v


class ScheduleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    timezone: str = Field(default="America/Sao_Paulo", max_length=50)
    intervals: list[IntervalCreate] = Field(default_factory=list)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        from zoneinfo import available_timezones

        if v not in available_timezones():
            raise ValueError(f"Timezone '{v}' nao e valido (IANA).")
        return v


class ScheduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    timezone: Optional[str] = Field(None, max_length=50)
    intervals: Optional[list[IntervalCreate]] = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        from zoneinfo import available_timezones

        if v not in available_timezones():
            raise ValueError(f"Timezone '{v}' nao e valido (IANA).")
        return v


class IntervalResponse(BaseModel):
    id: str
    day_of_week: int
    start_time: str
    end_time: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row) -> "IntervalResponse":
        return cls(
            id=row.id,
            day_of_week=row.day_of_week,
            start_time=(
                row.start_time.strftime("%H:%M")
                if isinstance(row.start_time, time)
                else str(row.start_time)
            ),
            end_time=(
                row.end_time.strftime("%H:%M")
                if isinstance(row.end_time, time)
                else str(row.end_time)
            ),
        )


class ScheduleResponse(BaseModel):
    id: str
    name: str
    timezone: str
    is_default: bool
    intervals: list[IntervalResponse] = []
    createdAt: str
    updatedAt: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row) -> "ScheduleResponse":
        return cls(
            id=row.id,
            name=row.name,
            timezone=row.timezone,
            is_default=row.is_default,
            intervals=[
                IntervalResponse.from_orm_row(i)
                for i in (getattr(row, "intervals") or [])
            ],
            createdAt=(
                row.created_at.isoformat() if row.created_at else ""
            ),
            updatedAt=(
                row.updated_at.isoformat() if row.updated_at else ""
            ),
        )


# ────────────────────────────────────────────────────────────────
# OVERRIDES
# ────────────────────────────────────────────────────────────────

class OverrideCreate(BaseModel):
    override_date: date
    is_available: bool
    start_time: Optional[str] = Field(
        None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$"
    )
    end_time: Optional[str] = Field(
        None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$"
    )
    reason: Optional[str] = Field(None, max_length=255)

    @field_validator("start_time")
    @classmethod
    def require_times_if_available(cls, v, info):
        is_available = info.data.get("is_available")
        if is_available is True and v is None:
            raise ValueError(
                "start_time e obrigatorio quando is_available=true."
            )
        return v

    @field_validator("end_time")
    @classmethod
    def require_end_time_if_available(cls, v, info):
        is_available = info.data.get("is_available")
        if is_available is True and v is None:
            raise ValueError(
                "end_time e obrigatorio quando is_available=true."
            )
        return v


class OverrideResponse(BaseModel):
    id: str
    override_date: str
    is_available: bool
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    reason: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row) -> "OverrideResponse":
        return cls(
            id=row.id,
            override_date=(
                row.override_date.isoformat() if row.override_date else ""
            ),
            is_available=row.is_available,
            start_time=(
                row.start_time.strftime("%H:%M") if row.start_time else None
            ),
            end_time=(
                row.end_time.strftime("%H:%M") if row.end_time else None
            ),
            reason=row.reason,
        )


# ────────────────────────────────────────────────────────────────
# BOOKINGS
# ────────────────────────────────────────────────────────────────

class BookingCreatePublic(BaseModel):
    """Schema para criacao de booking via endpoint publico."""
    org_slug: str = Field(..., min_length=1)
    event_type_slug: str = Field(..., min_length=1)
    guest_name: str = Field(..., min_length=1, max_length=255)
    guest_email: str = Field(
        ...,
        pattern=r"^[\w\.\+\-]+@[\w\-]+\.[\w\.\-]+$",
        max_length=255,
    )
    guest_notes: Optional[str] = None
    start_time: datetime
    timezone: str = Field(default="America/Sao_Paulo", max_length=50)
    duration_minutes: Optional[int] = None


class BookingCancelPublic(BaseModel):
    cancel_token: str = Field(..., min_length=1)
    reason: Optional[str] = Field(None, max_length=1000)


class BookingReschedulePublic(BaseModel):
    cancel_token: str = Field(..., min_length=1)
    new_start_time: datetime
    timezone: str = Field(default="America/Sao_Paulo", max_length=50)


class BookingCancelHost(BaseModel):
    reason: Optional[str] = Field(None, max_length=1000)


class RequestRescheduleBookingRequest(BaseModel):
    """Motivo opcional ao solicitar reagendamento ao convidado."""
    reason: Optional[str] = Field(None, max_length=1000)


class ReportBookingRequest(BaseModel):
    """Motivo e descrição opcional ao reportar uma reserva como suspeita."""
    reason: str = Field(
        ...,
        pattern="^(spam|unknown_person|other)$",
        description="spam=Spam ou reserva indesejada, unknown_person=Não conheço esta pessoa, other=Outro",
    )
    description: Optional[str] = Field(None, max_length=2000)


class AddBookingAttendeesRequest(BaseModel):
    """E-mails dos participantes adicionais a incluir na reserva."""
    emails: list[str] = Field(..., min_length=1, max_length=50)

    @field_validator("emails")
    @classmethod
    def validate_emails(cls, v: list[str]) -> list[str]:
        import re
        pattern = re.compile(r"^[\w\.\+\-]+@[\w\-]+\.[\w\.\-]+$")
        out = []
        for email in v:
            e = (email or "").strip()
            if not e:
                continue
            if not pattern.match(e):
                raise ValueError(f"E-mail invalido: {e}")
            out.append(e)
        if not out:
            raise ValueError("Informe ao menos um e-mail valido.")
        return out


class BookingAttendeeResponse(BaseModel):
    id: str
    booking_id: str
    name: str
    email: str
    is_optional: bool

    model_config = {"from_attributes": True}


class BookingRescheduleHost(BaseModel):
    new_start_time: datetime
    timezone: str = Field(default="America/Sao_Paulo", max_length=50)


class BookingResponse(BaseModel):
    id: str
    uid: str
    event_type_id: str
    host_user_id: Optional[str] = None
    host_agent_config_id: Optional[str] = None
    guest_name: str
    guest_email: str
    guest_notes: Optional[str] = None
    start_time: str
    end_time: str
    duration_minutes: int
    timezone: str
    status: str
    cancellation_reason: Optional[str] = None
    cancelled_by: Optional[str] = None
    meeting_url: Optional[str] = None
    rescheduled_from: Optional[str] = None
    attendees: list[BookingAttendeeResponse] = []
    createdAt: str
    updatedAt: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row) -> "BookingResponse":
        attendees = getattr(row, "attendees", None) or []
        return cls(
            id=row.id,
            uid=row.uid,
            event_type_id=row.event_type_id,
            host_user_id=row.host_user_id,
            host_agent_config_id=row.host_agent_config_id,
            guest_name=row.guest_name,
            guest_email=row.guest_email,
            guest_notes=row.guest_notes,
            start_time=(
                row.start_time.isoformat() if row.start_time else ""
            ),
            end_time=row.end_time.isoformat() if row.end_time else "",
            duration_minutes=row.duration_minutes,
            timezone=row.timezone,
            status=(
                row.status.value
                if hasattr(row.status, "value")
                else str(row.status)
            ),
            cancellation_reason=row.cancellation_reason,
            cancelled_by=(
                row.cancelled_by.value
                if row.cancelled_by and hasattr(row.cancelled_by, "value")
                else None
            ),
            meeting_url=row.meeting_url,
            rescheduled_from=(
                row.rescheduled_from.isoformat()
                if getattr(row, "rescheduled_from", None) else None
            ),
            attendees=[BookingAttendeeResponse.model_validate(a) for a in attendees],
            createdAt=(
                row.created_at.isoformat() if row.created_at else ""
            ),
            updatedAt=(
                row.updated_at.isoformat() if row.updated_at else ""
            ),
        )


class BookingPublicResponse(BaseModel):
    """Response reduzido para endpoints publicos."""
    uid: str
    event_title: str
    host_name: str
    guest_name: str
    guest_email: str
    start_time: str
    end_time: str
    duration_minutes: int
    timezone: str
    status: str
    meeting_url: Optional[str] = None
    cancel_token: str


# ────────────────────────────────────────────────────────────────
# SLOTS
# ────────────────────────────────────────────────────────────────

class SlotResponse(BaseModel):
    time: str
    duration_minutes: int


class DaySlotsResponse(BaseModel):
    date: str
    slots: list[SlotResponse]


class AvailableSlotsResponse(BaseModel):
    event_type: EventTypeResponse
    timezone: str
    days: list[DaySlotsResponse]


# ────────────────────────────────────────────────────────────────
# PUBLIC PROFILE
# ────────────────────────────────────────────────────────────────

class PublicEventTypeItem(BaseModel):
    slug: str
    title: str
    description: Optional[str] = None
    duration_minutes: int
    locations: list[LocationResponse] = []


class PublicProfileResponse(BaseModel):
    host_name: str
    host_type: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    org_name: str
    org_avatar_url: Optional[str] = None
    event_types: list[PublicEventTypeItem]


# ────────────────────────────────────────────────────────────────
# INSIGHTS
# ────────────────────────────────────────────────────────────────

class InsightsResponse(BaseModel):
    total_bookings: int
    cancellation_rate: float
    no_show_rate: float
    bookings_by_event_type: list[dict]
    bookings_by_weekday: list[dict]
    top_hours: list[dict]
    comparison_previous_period: Optional[dict] = None


# ────────────────────────────────────────────────────────────────
# WORKFLOWS
# ────────────────────────────────────────────────────────────────

class WorkflowStepCreate(BaseModel):
    trigger_type: str = Field(
        ...,
        pattern="^(before_event|after_event|on_booking|on_cancellation)$",
    )
    trigger_offset_minutes: Optional[int] = None
    action_type: str = Field(
        ..., pattern="^(send_email|send_notification)$"
    )
    action_config: dict
    step_order: int = 0
    is_active: bool = True


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    event_type_id: Optional[str] = None
    is_active: bool = True
    steps: list[WorkflowStepCreate] = Field(default_factory=list)


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    event_type_id: Optional[str] = None
    is_active: Optional[bool] = None
    steps: Optional[list[WorkflowStepCreate]] = None


class WorkflowStepResponse(BaseModel):
    id: str
    trigger_type: str
    trigger_offset_minutes: Optional[int] = None
    action_type: str
    action_config: dict
    step_order: int
    is_active: bool

    model_config = {"from_attributes": True}


class WorkflowResponse(BaseModel):
    id: str
    name: str
    event_type_id: Optional[str] = None
    is_active: bool
    steps: list[WorkflowStepResponse] = []
    createdAt: str
    updatedAt: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row) -> "WorkflowResponse":
        return cls(
            id=row.id,
            name=row.name,
            event_type_id=row.event_type_id,
            is_active=row.is_active,
            steps=[
                WorkflowStepResponse.model_validate(s)
                for s in (getattr(row, "steps") or [])
            ],
            createdAt=(
                row.created_at.isoformat() if row.created_at else ""
            ),
            updatedAt=(
                row.updated_at.isoformat() if row.updated_at else ""
            ),
        )


# ────────────────────────────────────────────────────────────────
# WEBHOOKS
# ────────────────────────────────────────────────────────────────

class WebhookCreate(BaseModel):
    url: str = Field(..., min_length=1, max_length=500)
    events: list[str] = Field(..., min_length=1)
    is_active: bool = True

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: list[str]) -> list[str]:
        valid = {
            "booking.created",
            "booking.cancelled",
            "booking.rescheduled",
            "booking.no_show",
            "booking.attendees_added",
        }
        for e in v:
            if e not in valid:
                raise ValueError(
                    f"Evento '{e}' invalido. Validos: {valid}"
                )
        return v


class WebhookResponse(BaseModel):
    id: str
    url: str
    events: list[str]
    secret: str
    is_active: bool
    createdAt: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_row(cls, row) -> "WebhookResponse":
        return cls(
            id=row.id,
            url=row.url,
            events=row.events or [],
            secret=row.secret,
            is_active=row.is_active,
            createdAt=(
                row.created_at.isoformat() if row.created_at else ""
            ),
        )
