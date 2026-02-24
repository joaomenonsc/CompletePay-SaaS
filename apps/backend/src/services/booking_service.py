"""
Servico de booking: criacao com double-check para race condition,
cancelamento por token (guest) e consulta por UID.
"""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.models import AgentConfig, Organization
from src.db.models_calendar import (
    Booking,
    BookingStatus,
    CancelledBy,
    EventType,
)
from src.schemas.calendar import BookingCreatePublic

logger = logging.getLogger("completepay.calendar")


class SlotConflictError(Exception):
    """Horario solicitado ja foi reservado (race condition)."""

    def __init__(self, message: str = "Horario indisponivel. Selecione outro."):
        self.message = message
        super().__init__(self.message)


def _resolve_event_type(
    db: Session, org_slug: str, event_type_slug: str
) -> EventType:
    """Resolve EventType por org_slug e event_type_slug. Levanta 404 se nao encontrar."""
    org = db.execute(
        select(Organization).where(Organization.slug == org_slug)
    ).scalars().one_or_none()
    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organizacao nao encontrada.",
        )

    event_type = db.execute(
        select(EventType).where(
            EventType.organization_id == org.id,
            EventType.slug == event_type_slug,
            EventType.is_active.is_(True),
        )
    ).scalars().one_or_none()
    if not event_type:
        raise HTTPException(
            status_code=404,
            detail="Tipo de evento nao encontrado ou inativo.",
        )
    return event_type


def _parse_slot_times(
    data: BookingCreatePublic, event_type: EventType
) -> tuple[datetime, datetime]:
    """Converte start_time + timezone em (slot_start_utc, slot_end_utc)."""
    tz = ZoneInfo(data.timezone)
    duration = data.duration_minutes or event_type.duration_minutes

    start = data.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=tz)
    slot_start_utc = start.astimezone(ZoneInfo("UTC"))
    slot_end_utc = slot_start_utc + timedelta(minutes=duration)
    return slot_start_utc, slot_end_utc


def create_booking(db: Session, data: BookingCreatePublic) -> Booking:
    """
    Cria booking com double-check de disponibilidade (evita race condition).
    Levanta SlotConflictError se o slot nao estiver mais disponivel.
    """
    from src.services.availability_engine import AvailabilityEngine

    event_type = _resolve_event_type(
        db, data.org_slug, data.event_type_slug
    )
    slot_start_utc, slot_end_utc = _parse_slot_times(data, event_type)

    # Primeiro check: slot ainda disponivel?
    engine = AvailabilityEngine(db)
    start_date = slot_start_utc.date()
    slots_data = engine.get_available_slots(
        event_type_id=event_type.id,
        date_from=start_date,
        date_to=start_date,
        requester_timezone=data.timezone,
    )
    tz_requester = ZoneInfo(data.timezone)
    slot_time_str = slot_start_utc.astimezone(tz_requester).strftime("%H:%M")
    found = False
    for day in slots_data:
        if day["date"] == start_date.isoformat():
            for s in day.get("slots", []):
                if s.get("time") == slot_time_str:
                    found = True
                    break
            break
    if not found:
        raise SlotConflictError("Horario indisponivel. Selecione outro.")

    status = (
        BookingStatus.pending
        if event_type.requires_confirmation
        else BookingStatus.confirmed
    )
    booking = Booking(
        organization_id=event_type.organization_id,
        event_type_id=event_type.id,
        host_user_id=event_type.user_id,
        host_agent_config_id=event_type.agent_config_id,
        guest_name=data.guest_name,
        guest_email=data.guest_email,
        guest_notes=data.guest_notes,
        start_time=slot_start_utc,
        end_time=slot_end_utc,
        duration_minutes=event_type.duration_minutes,
        timezone=data.timezone,
        status=status,
    )
    db.add(booking)
    db.flush()

    # Segundo check: conflito com outros bookings (double-check)
    if event_type.user_id is not None:
        host_condition = Booking.host_user_id == event_type.user_id
    else:
        host_condition = (
            Booking.host_agent_config_id == event_type.agent_config_id
        )

    conflict = db.execute(
        select(Booking).where(
            Booking.organization_id == event_type.organization_id,
            host_condition,
            Booking.start_time < slot_end_utc,
            Booking.end_time > slot_start_utc,
            Booking.status.in_([BookingStatus.confirmed, BookingStatus.pending]),
            Booking.id != booking.id,
        )
    ).first()

    if conflict is not None:
        db.rollback()
        raise SlotConflictError("Horario indisponivel. Selecione outro.")

    db.commit()
    db.refresh(booking)
    logger.info("Booking criado: %s (event_type=%s)", booking.id, event_type.id)
    return booking


def get_booking_by_uid(db: Session, uid: str) -> Booking | None:
    """Retorna booking pelo UID publico ou None."""
    return db.execute(
        select(Booking).where(Booking.uid == uid)
    ).scalars().one_or_none()


def get_booking_by_id(
    db: Session, booking_id: str, organization_id: str
) -> Booking | None:
    """Retorna booking por id se pertencer à organização."""
    return db.execute(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.organization_id == organization_id,
        )
    ).scalars().one_or_none()


def cancel_booking_by_host(
    db: Session, booking_id: str, organization_id: str, reason: str | None = None
) -> Booking:
    """Cancela booking pelo host (dashboard). Levanta 404 se não encontrar."""
    booking = get_booking_by_id(db, booking_id, organization_id)
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Reserva nao encontrada.",
        )
    if booking.status == BookingStatus.cancelled:
        raise HTTPException(
            status_code=400,
            detail="Reserva ja foi cancelada.",
        )
    booking.status = BookingStatus.cancelled
    booking.cancellation_reason = reason
    booking.cancelled_by = CancelledBy.host
    db.commit()
    db.refresh(booking)
    logger.info("Booking cancelado pelo host: %s", booking.id)
    return booking


def reschedule_booking_by_host(
    db: Session,
    booking_id: str,
    organization_id: str,
    new_start_utc: datetime,
    duration_minutes: int,
) -> Booking:
    """Reagenda booking (host). Atualiza start_time/end_time e rescheduled_from."""
    from datetime import timedelta

    booking = get_booking_by_id(db, booking_id, organization_id)
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Reserva nao encontrada.",
        )
    if booking.status == BookingStatus.cancelled:
        raise HTTPException(
            status_code=400,
            detail="Nao e possivel reagendar reserva cancelada.",
        )
    old_start = booking.start_time
    new_end_utc = new_start_utc + timedelta(minutes=duration_minutes)
    booking.rescheduled_from = old_start
    booking.start_time = new_start_utc
    booking.end_time = new_end_utc
    db.commit()
    db.refresh(booking)
    logger.info("Booking reagendado pelo host: %s", booking.id)
    return booking


def cancel_booking_by_token(
    db: Session, uid: str, cancel_token: str, reason: str | None = None
) -> Booking:
    """Cancela booking pelo guest usando UID e cancel_token. Levanta 404/403 se invalido."""
    booking = get_booking_by_uid(db, uid)
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Reserva nao encontrada.",
        )
    if booking.cancel_token != cancel_token:
        raise HTTPException(
            status_code=403,
            detail="Token de cancelamento invalido.",
        )
    if booking.status == BookingStatus.cancelled:
        raise HTTPException(
            status_code=400,
            detail="Reserva ja foi cancelada.",
        )

    booking.status = BookingStatus.cancelled
    booking.cancellation_reason = reason
    booking.cancelled_by = CancelledBy.guest
    db.commit()
    db.refresh(booking)
    logger.info("Booking cancelado pelo guest: %s", booking.id)
    return booking
