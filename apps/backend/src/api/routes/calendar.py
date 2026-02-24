"""
Router autenticado para o modulo de Calendario.
Requer JWT + X-Organization-Id.
"""
import logging
from collections import defaultdict
from datetime import datetime, time as py_time, timedelta
from zoneinfo import ZoneInfo
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.api.deps import require_organization_id
from src.api.middleware.auth import require_user_id
from src.db.models import AgentConfig
from src.db.models_calendar import (
    AvailabilityOverride,
    AvailabilitySchedule,
    AvailabilityScheduleInterval,
    Booking,
    BookingStatus,
    EventType,
    EventTypeLimit,
    EventTypeLocation,
    LocationType,
    Webhook,
    Workflow,
    WorkflowActionType,
    WorkflowStep,
    WorkflowTriggerType,
)
from src.db.session import get_db
from src.schemas.calendar import (
    BookingCancelHost,
    BookingRescheduleHost,
    BookingResponse,
    EventTypeCreate,
    EventTypeLimitResponse,
    EventTypeLimitUpsert,
    EventTypeResponse,
    EventTypeUpdate,
    InsightsResponse,
    OverrideCreate,
    OverrideResponse,
    ScheduleCreate,
    ScheduleResponse,
    ScheduleUpdate,
    WebhookCreate,
    WebhookResponse,
    WorkflowCreate,
    WorkflowResponse,
    WorkflowStepCreate,
    WorkflowUpdate,
)
from src.services.webhook_service import dispatch_webhooks_for_booking_task

logger = logging.getLogger("completepay.calendar")

router = APIRouter(
    prefix="/api/v1/calendar",
    tags=["calendar"],
)


# ────────────────────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────────────────────

def _get_event_type_or_404(
    db: Session, event_type_id: str, organization_id: str
) -> EventType:
    et = db.execute(
        select(EventType).where(
            EventType.id == event_type_id,
            EventType.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not et:
        raise HTTPException(
            status_code=404, detail="Tipo de evento nao encontrado."
        )
    return et


def _get_schedule_or_404(
    db: Session, schedule_id: str, organization_id: str
) -> AvailabilitySchedule:
    s = db.execute(
        select(AvailabilitySchedule).where(
            AvailabilitySchedule.id == schedule_id,
            AvailabilitySchedule.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not s:
        raise HTTPException(
            status_code=404, detail="Schedule nao encontrado."
        )
    return s


# ────────────────────────────────────────────────────────────────
# EVENT TYPES CRUD
# ────────────────────────────────────────────────────────────────

@router.post("/event-types", response_model=EventTypeResponse, status_code=201)
def create_event_type(
    body: EventTypeCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Cria um novo tipo de evento."""
    existing = db.execute(
        select(EventType).where(
            EventType.organization_id == organization_id,
            EventType.slug == body.slug,
        )
    ).scalars().one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Slug '{body.slug}' ja existe nesta organizacao.",
        )

    if body.agent_config_id:
        agent = db.execute(
            select(AgentConfig).where(
                AgentConfig.id == body.agent_config_id,
                AgentConfig.organization_id == organization_id,
            )
        ).scalars().one_or_none()
        if not agent:
            raise HTTPException(
                status_code=400,
                detail="Agente nao encontrado nesta organizacao.",
            )

    event_type = EventType(
        organization_id=organization_id,
        user_id=user_id if not body.agent_config_id else None,
        agent_config_id=body.agent_config_id,
        title=body.title,
        description=body.description,
        slug=body.slug,
        duration_minutes=body.duration_minutes,
        is_active=body.is_active,
        color=body.color,
        requires_confirmation=body.requires_confirmation,
        allow_multiple_durations=body.allow_multiple_durations,
        additional_durations=body.additional_durations,
        schedule_id=body.schedule_id,
    )
    db.add(event_type)
    db.flush()

    for loc in body.locations:
        db.add(EventTypeLocation(
            event_type_id=event_type.id,
            location_type=LocationType(loc.location_type),
            location_value=loc.location_value,
            position=loc.position,
        ))

    db.commit()
    db.refresh(event_type)
    logger.info("Event type criado: %s (%s)", event_type.id, event_type.title)
    return EventTypeResponse.from_orm_row(event_type)


@router.get("/event-types", response_model=list[EventTypeResponse])
def list_event_types(
    host_type: Optional[str] = Query(None, pattern="^(user|agent|all)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Lista event types da organizacao."""
    query = (
        select(EventType)
        .where(EventType.organization_id == organization_id)
        .order_by(EventType.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )

    if host_type == "user":
        query = query.where(EventType.agent_config_id.is_(None))
    elif host_type == "agent":
        query = query.where(EventType.agent_config_id.isnot(None))

    rows = db.execute(query).scalars().all()
    return [EventTypeResponse.from_orm_row(r) for r in rows]


@router.get(
    "/event-types/{event_type_id}",
    response_model=EventTypeResponse,
)
def get_event_type(
    event_type_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Retorna detalhes de um event type."""
    et = _get_event_type_or_404(db, event_type_id, organization_id)
    return EventTypeResponse.from_orm_row(et)


@router.patch(
    "/event-types/{event_type_id}",
    response_model=EventTypeResponse,
)
def update_event_type(
    event_type_id: str,
    body: EventTypeUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Atualiza campos parciais do event type."""
    et = _get_event_type_or_404(db, event_type_id, organization_id)
    data = body.model_dump(exclude_unset=True)

    if "slug" in data and data["slug"] != et.slug:
        existing = db.execute(
            select(EventType).where(
                EventType.organization_id == organization_id,
                EventType.slug == data["slug"],
                EventType.id != et.id,
            )
        ).scalars().one_or_none()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Slug '{data['slug']}' ja existe.",
            )

    locations_data = data.pop("locations", None)
    for key, value in data.items():
        setattr(et, key, value)

    if locations_data is not None:
        for loc in et.locations:
            db.delete(loc)
        for loc_data in locations_data:
            db.add(EventTypeLocation(
                event_type_id=et.id,
                location_type=LocationType(loc_data["location_type"]),
                location_value=loc_data.get("location_value"),
                position=loc_data.get("position", 0),
            ))

    db.commit()
    db.refresh(et)
    return EventTypeResponse.from_orm_row(et)


@router.patch("/event-types/{event_type_id}/toggle")
def toggle_event_type(
    event_type_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Alterna ativo/inativo."""
    et = _get_event_type_or_404(db, event_type_id, organization_id)
    et.is_active = not et.is_active
    db.commit()
    return {"id": et.id, "is_active": et.is_active}


@router.delete("/event-types/{event_type_id}", status_code=204)
def delete_event_type(
    event_type_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Exclui um event type."""
    et = _get_event_type_or_404(db, event_type_id, organization_id)
    db.delete(et)
    db.commit()
    return None


# ────────────────────────────────────────────────────────────────
# EVENT TYPE LIMITS
# ────────────────────────────────────────────────────────────────

@router.put(
    "/event-types/{event_type_id}/limits",
    response_model=EventTypeLimitResponse,
)
def upsert_limits(
    event_type_id: str,
    body: EventTypeLimitUpsert,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Cria ou atualiza limites do event type."""
    et = _get_event_type_or_404(db, event_type_id, organization_id)

    if et.limits:
        limits = et.limits
        data = body.model_dump(exclude_unset=True)
        if "frequency_limit" in data and data["frequency_limit"] is not None:
            data["frequency_limit"] = (
                data["frequency_limit"].model_dump()
                if hasattr(data["frequency_limit"], "model_dump")
                else data["frequency_limit"]
            )
        for key, value in data.items():
            setattr(limits, key, value)
    else:
        freq = (
            body.frequency_limit.model_dump()
            if body.frequency_limit
            else None
        )
        limits = EventTypeLimit(
            event_type_id=et.id,
            buffer_before_minutes=body.buffer_before_minutes,
            buffer_after_minutes=body.buffer_after_minutes,
            minimum_notice_minutes=body.minimum_notice_minutes,
            slot_interval_minutes=body.slot_interval_minutes,
            max_bookings_per_day=body.max_bookings_per_day,
            limit_to_first_slot=body.limit_to_first_slot,
            max_duration_per_day_minutes=body.max_duration_per_day_minutes,
            max_future_days=body.max_future_days,
            frequency_limit=freq,
        )
        db.add(limits)

    db.commit()
    db.refresh(limits)
    return EventTypeLimitResponse.from_orm_row(limits)


@router.get(
    "/event-types/{event_type_id}/limits",
    response_model=EventTypeLimitResponse,
)
def get_limits(
    event_type_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Retorna limites do event type."""
    et = _get_event_type_or_404(db, event_type_id, organization_id)
    if not et.limits:
        raise HTTPException(
            status_code=404,
            detail="Nenhum limite configurado.",
        )
    return EventTypeLimitResponse.from_orm_row(et.limits)


# ────────────────────────────────────────────────────────────────
# SCHEDULES CRUD
# ────────────────────────────────────────────────────────────────

@router.post(
    "/schedules", response_model=ScheduleResponse, status_code=201
)
def create_schedule(
    body: ScheduleCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Cria um schedule de disponibilidade."""
    schedule = AvailabilitySchedule(
        organization_id=organization_id,
        user_id=user_id,
        name=body.name,
        timezone=body.timezone,
    )
    db.add(schedule)
    db.flush()

    # Se a org ainda nao tem schedule padrao, este sera o padrao
    existing_default = db.execute(
        select(AvailabilitySchedule).where(
            AvailabilitySchedule.organization_id == organization_id,
            AvailabilitySchedule.is_default.is_(True),
        )
    ).first()
    if existing_default is None:
        schedule.is_default = True

    for interval in body.intervals:
        h_s, m_s = map(int, interval.start_time.split(":"))
        h_e, m_e = map(int, interval.end_time.split(":"))
        db.add(AvailabilityScheduleInterval(
            schedule_id=schedule.id,
            day_of_week=interval.day_of_week,
            start_time=py_time(h_s, m_s),
            end_time=py_time(h_e, m_e),
        ))

    db.commit()
    db.refresh(schedule)
    return ScheduleResponse.from_orm_row(schedule)


@router.get("/schedules", response_model=list[ScheduleResponse])
def list_schedules(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Lista schedules da organizacao."""
    rows = db.execute(
        select(AvailabilitySchedule)
        .where(
            AvailabilitySchedule.organization_id == organization_id
        )
        .order_by(AvailabilitySchedule.is_default.desc())
    ).scalars().all()
    return [ScheduleResponse.from_orm_row(r) for r in rows]


@router.get(
    "/schedules/{schedule_id}", response_model=ScheduleResponse
)
def get_schedule(
    schedule_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Retorna detalhes de um schedule."""
    s = _get_schedule_or_404(db, schedule_id, organization_id)
    return ScheduleResponse.from_orm_row(s)


@router.patch(
    "/schedules/{schedule_id}", response_model=ScheduleResponse
)
def update_schedule(
    schedule_id: str,
    body: ScheduleUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Atualiza schedule."""
    s = _get_schedule_or_404(db, schedule_id, organization_id)
    data = body.model_dump(exclude_unset=True)

    intervals_data = data.pop("intervals", None)
    for key, value in data.items():
        setattr(s, key, value)

    if intervals_data is not None:
        for interval in s.intervals:
            db.delete(interval)
        for interval in intervals_data:
            h_s, m_s = map(int, interval["start_time"].split(":"))
            h_e, m_e = map(int, interval["end_time"].split(":"))
            db.add(AvailabilityScheduleInterval(
                schedule_id=s.id,
                day_of_week=interval["day_of_week"],
                start_time=py_time(h_s, m_s),
                end_time=py_time(h_e, m_e),
            ))

    db.commit()
    db.refresh(s)
    return ScheduleResponse.from_orm_row(s)


@router.delete("/schedules/{schedule_id}", status_code=204)
def delete_schedule(
    schedule_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Exclui schedule (falha se vinculado a event type ativo)."""
    s = _get_schedule_or_404(db, schedule_id, organization_id)

    linked = db.execute(
        select(EventType).where(
            EventType.schedule_id == s.id,
            EventType.is_active.is_(True),
        )
    ).scalars().first()
    if linked:
        raise HTTPException(
            status_code=409,
            detail="Schedule vinculado a event type ativo.",
        )

    db.delete(s)
    db.commit()
    return None


# ────────────────────────────────────────────────────────────────
# BOOKINGS
# ────────────────────────────────────────────────────────────────

@router.get(
    "/bookings",
    response_model=list[BookingResponse],
)
def list_bookings(
    status: Optional[str] = Query(None, description="Filtrar por status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Lista bookings da organizacao."""
    query = (
        select(Booking)
        .where(Booking.organization_id == organization_id)
        .order_by(Booking.start_time.desc())
        .limit(limit)
        .offset(offset)
    )
    if status:
        try:
            status_enum = BookingStatus(status)
            query = query.where(Booking.status == status_enum)
        except ValueError:
            pass  # status invalido, ignora filtro
    rows = db.execute(query).scalars().all()
    return [BookingResponse.from_orm_row(r) for r in rows]


@router.get(
    "/bookings/{booking_id}",
    response_model=BookingResponse,
)
def get_booking(
    booking_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Detalhe de um booking da organização."""
    from src.services.booking_service import get_booking_by_id

    booking = get_booking_by_id(db, booking_id, organization_id)
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Reserva nao encontrada.",
        )
    return BookingResponse.from_orm_row(booking)


@router.patch(
    "/bookings/{booking_id}/cancel",
    response_model=BookingResponse,
)
def cancel_booking_host(
    booking_id: str,
    body: BookingCancelHost,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Cancela booking (pelo host)."""
    from src.services.booking_service import cancel_booking_by_host

    booking = cancel_booking_by_host(
        db, booking_id, organization_id, reason=body.reason
    )
    background_tasks.add_task(
        dispatch_webhooks_for_booking_task, str(booking.id), "booking.cancelled"
    )
    return BookingResponse.from_orm_row(booking)


@router.patch(
    "/bookings/{booking_id}/reschedule",
    response_model=BookingResponse,
)
def reschedule_booking_host(
    booking_id: str,
    body: BookingRescheduleHost,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Reagenda booking (pelo host)."""
    from zoneinfo import ZoneInfo

    from src.services.booking_service import (
        get_booking_by_id,
        reschedule_booking_by_host,
    )

    booking = get_booking_by_id(db, booking_id, organization_id)
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Reserva nao encontrada.",
        )
    new_start = body.new_start_time
    if new_start.tzinfo is None:
        new_start = new_start.replace(tzinfo=ZoneInfo(body.timezone))
    new_start_utc = new_start.astimezone(ZoneInfo("UTC"))
    booking = reschedule_booking_by_host(
        db,
        booking_id,
        organization_id,
        new_start_utc,
        booking.duration_minutes,
    )
    background_tasks.add_task(
        dispatch_webhooks_for_booking_task, str(booking.id), "booking.rescheduled"
    )
    return BookingResponse.from_orm_row(booking)


@router.post("/schedules/{schedule_id}/set-default")
def set_default_schedule(
    schedule_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Define schedule como padrao."""
    s = _get_schedule_or_404(db, schedule_id, organization_id)

    others = db.execute(
        select(AvailabilitySchedule).where(
            AvailabilitySchedule.organization_id == organization_id,
            AvailabilitySchedule.user_id == s.user_id,
            AvailabilitySchedule.is_default.is_(True),
        )
    ).scalars().all()
    for other in others:
        other.is_default = False

    s.is_default = True
    db.commit()
    return {"id": s.id, "is_default": True}


# ────────────────────────────────────────────────────────────────
# OVERRIDES
# ────────────────────────────────────────────────────────────────

@router.post(
    "/schedules/{schedule_id}/overrides",
    response_model=OverrideResponse,
    status_code=201,
)
def create_override(
    schedule_id: str,
    body: OverrideCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Cria override de disponibilidade para uma data."""
    s = _get_schedule_or_404(db, schedule_id, organization_id)

    existing = db.execute(
        select(AvailabilityOverride).where(
            AvailabilityOverride.schedule_id == s.id,
            AvailabilityOverride.override_date == body.override_date,
        )
    ).scalars().one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Override ja existe para esta data.",
        )

    start_t = None
    end_t = None
    if body.start_time:
        h, m = map(int, body.start_time.split(":"))
        start_t = py_time(h, m)
    if body.end_time:
        h, m = map(int, body.end_time.split(":"))
        end_t = py_time(h, m)

    override = AvailabilityOverride(
        schedule_id=s.id,
        override_date=body.override_date,
        is_available=body.is_available,
        start_time=start_t,
        end_time=end_t,
        reason=body.reason,
    )
    db.add(override)
    db.commit()
    db.refresh(override)
    return OverrideResponse.from_orm_row(override)


@router.get(
    "/schedules/{schedule_id}/overrides",
    response_model=list[OverrideResponse],
)
def list_overrides(
    schedule_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Lista overrides do schedule."""
    s = _get_schedule_or_404(db, schedule_id, organization_id)
    query = select(AvailabilityOverride).where(
        AvailabilityOverride.schedule_id == s.id
    ).order_by(AvailabilityOverride.override_date)
    rows = db.execute(query).scalars().all()
    return [OverrideResponse.from_orm_row(r) for r in rows]


@router.delete(
    "/schedules/{schedule_id}/overrides/{override_id}",
    status_code=204,
)
def delete_override(
    schedule_id: str,
    override_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Remove override."""
    _get_schedule_or_404(db, schedule_id, organization_id)
    override = db.execute(
        select(AvailabilityOverride).where(
            AvailabilityOverride.id == override_id,
            AvailabilityOverride.schedule_id == schedule_id,
        )
    ).scalars().one_or_none()
    if not override:
        raise HTTPException(
            status_code=404, detail="Override nao encontrado."
        )
    db.delete(override)
    db.commit()
    return None


# ────────────────────────────────────────────────────────────────
# INSIGHTS
# ────────────────────────────────────────────────────────────────

@router.get(
    "/insights",
    response_model=InsightsResponse,
)
def get_insights(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Métricas de agendamento da organização (últimos 90 dias)."""
    since = datetime.now(ZoneInfo("UTC")) - timedelta(days=90)
    rows = db.execute(
        select(Booking, EventType.title)
        .join(EventType, EventType.id == Booking.event_type_id)
        .where(
            Booking.organization_id == organization_id,
            Booking.start_time >= since,
        )
    ).all()

    total = len(rows)
    cancelled = sum(1 for r in rows if r[0].status == BookingStatus.cancelled)
    no_show = sum(1 for r in rows if r[0].status == BookingStatus.no_show)
    completed_or_confirmed = sum(
        1 for r in rows
        if r[0].status in (BookingStatus.confirmed, BookingStatus.completed)
    )

    cancellation_rate = (cancelled / total * 100.0) if total else 0.0
    no_show_rate = (no_show / total * 100.0) if total else 0.0

    by_event_type = defaultdict(lambda: {"event_type_id": "", "title": "", "count": 0})
    for b, title in rows:
        key = b.event_type_id
        by_event_type[key]["event_type_id"] = key
        by_event_type[key]["title"] = title or ""
        by_event_type[key]["count"] += 1
    bookings_by_event_type = list(by_event_type.values())

    by_weekday = defaultdict(lambda: {"day": 0, "count": 0})
    for b, _ in rows:
        d = b.start_time.weekday() if b.start_time else 0
        by_weekday[d]["day"] = d
        by_weekday[d]["count"] += 1
    bookings_by_weekday = [{"day": d, "count": by_weekday[d]["count"]} for d in range(7)]

    by_hour = defaultdict(lambda: {"hour": 0, "count": 0})
    for b, _ in rows:
        h = b.start_time.hour if b.start_time else 0
        by_hour[h]["hour"] = h
        by_hour[h]["count"] += 1
    top_hours = [{"hour": h, "count": by_hour[h]["count"]} for h in range(24)]
    top_hours.sort(key=lambda x: -x["count"])

    return InsightsResponse(
        total_bookings=total,
        cancellation_rate=round(cancellation_rate, 2),
        no_show_rate=round(no_show_rate, 2),
        bookings_by_event_type=bookings_by_event_type,
        bookings_by_weekday=bookings_by_weekday,
        top_hours=top_hours[:24],
        comparison_previous_period=None,
    )


# ────────────────────────────────────────────────────────────────
# WORKFLOWS
# ────────────────────────────────────────────────────────────────

def _get_workflow_or_404(
    db: Session, workflow_id: str, organization_id: str
) -> Workflow:
    w = db.execute(
        select(Workflow).where(
            Workflow.id == workflow_id,
            Workflow.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not w:
        raise HTTPException(
            status_code=404,
            detail="Workflow nao encontrado.",
        )
    return w


@router.post(
    "/workflows",
    response_model=WorkflowResponse,
    status_code=201,
)
def create_workflow(
    body: WorkflowCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Cria um workflow."""
    workflow = Workflow(
        organization_id=organization_id,
        event_type_id=body.event_type_id,
        name=body.name,
        is_active=body.is_active,
    )
    db.add(workflow)
    db.flush()
    for step in body.steps:
        db.add(WorkflowStep(
            workflow_id=workflow.id,
            trigger_type=WorkflowTriggerType(step.trigger_type),
            trigger_offset_minutes=step.trigger_offset_minutes,
            action_type=WorkflowActionType(step.action_type),
            action_config=step.action_config,
            step_order=step.step_order,
            is_active=step.is_active,
        ))
    db.commit()
    db.refresh(workflow)
    return WorkflowResponse.from_orm_row(workflow)


@router.get(
    "/workflows",
    response_model=list[WorkflowResponse],
)
def list_workflows(
    event_type_id: Optional[str] = Query(None),
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Lista workflows da organização."""
    query = (
        select(Workflow)
        .where(Workflow.organization_id == organization_id)
        .order_by(Workflow.updated_at.desc())
    )
    if event_type_id:
        query = query.where(Workflow.event_type_id == event_type_id)
    rows = db.execute(query).scalars().all()
    return [WorkflowResponse.from_orm_row(r) for r in rows]




@router.get(
    "/workflows/{workflow_id}",
    response_model=WorkflowResponse,
)
def get_workflow(
    workflow_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Detalhe de um workflow."""
    w = _get_workflow_or_404(db, workflow_id, organization_id)
    return WorkflowResponse.from_orm_row(w)


@router.patch(
    "/workflows/{workflow_id}",
    response_model=WorkflowResponse,
)
def update_workflow(
    workflow_id: str,
    body: WorkflowUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Atualiza um workflow."""
    w = _get_workflow_or_404(db, workflow_id, organization_id)
    data = body.model_dump(exclude_unset=True)
    steps_data = data.pop("steps", None)
    for key, value in data.items():
        setattr(w, key, value)
    if steps_data is not None:
        for s in w.steps:
            db.delete(s)
        for step in steps_data:
            db.add(WorkflowStep(
                workflow_id=w.id,
                trigger_type=WorkflowTriggerType(step["trigger_type"]),
                trigger_offset_minutes=step.get("trigger_offset_minutes"),
                action_type=WorkflowActionType(step["action_type"]),
                action_config=step["action_config"],
                step_order=step.get("step_order", 0),
                is_active=step.get("is_active", True),
            ))
    db.commit()
    db.refresh(w)
    return WorkflowResponse.from_orm_row(w)


@router.delete(
    "/workflows/{workflow_id}",
    status_code=204,
)
def delete_workflow(
    workflow_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Exclui um workflow."""
    w = _get_workflow_or_404(db, workflow_id, organization_id)
    db.delete(w)
    db.commit()
    return None


# ────────────────────────────────────────────────────────────────
# WEBHOOKS (por event type)
# ────────────────────────────────────────────────────────────────

def _get_webhook_or_404(
    db: Session, webhook_id: str, event_type_id: str, organization_id: str
) -> Webhook:
    wh = db.execute(
        select(Webhook).where(
            Webhook.id == webhook_id,
            Webhook.event_type_id == event_type_id,
            Webhook.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not wh:
        raise HTTPException(
            status_code=404,
            detail="Webhook nao encontrado.",
        )
    return wh


@router.post(
    "/event-types/{event_type_id}/webhooks",
    response_model=WebhookResponse,
    status_code=201,
)
def create_webhook(
    event_type_id: str,
    body: WebhookCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Cria webhook para um tipo de evento."""
    _get_event_type_or_404(db, event_type_id, organization_id)
    webhook = Webhook(
        organization_id=organization_id,
        event_type_id=event_type_id,
        url=body.url,
        events=body.events,
        is_active=body.is_active,
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    return WebhookResponse.from_orm_row(webhook)


@router.get(
    "/event-types/{event_type_id}/webhooks",
    response_model=list[WebhookResponse],
)
def list_webhooks(
    event_type_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Lista webhooks do tipo de evento."""
    _get_event_type_or_404(db, event_type_id, organization_id)
    rows = db.execute(
        select(Webhook).where(Webhook.event_type_id == event_type_id)
    ).scalars().all()
    return [WebhookResponse.from_orm_row(r) for r in rows]


@router.delete(
    "/event-types/{event_type_id}/webhooks/{webhook_id}",
    status_code=204,
)
def delete_webhook(
    event_type_id: str,
    webhook_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Exclui um webhook."""
    _get_webhook_or_404(db, webhook_id, event_type_id, organization_id)
    wh = db.execute(
        select(Webhook).where(
            Webhook.id == webhook_id,
            Webhook.event_type_id == event_type_id,
        )
    ).scalars().one_or_none()
    if wh:
        db.delete(wh)
    db.commit()
    return None
