"""
Router publico do modulo Calendario (sem autenticacao).
Endpoints: perfil do host, slots disponiveis, criar/consultar/cancelar booking.
"""
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.auth.repository import get_user_by_id
from src.db.models import AgentConfig, Organization
from src.db.models_calendar import Booking, EventType
from src.db.session import get_db, SessionLocal
from src.schemas.calendar import (
    BookingCreatePublic,
    BookingCancelPublic,
    BookingPublicResponse,
    PublicProfileResponse,
    PublicEventTypeItem,
    LocationResponse,
    AvailableSlotsResponse,
    EventTypeResponse,
    DaySlotsResponse,
    SlotResponse,
)
from src.services.availability_engine import AvailabilityEngine
from src.services.booking_service import (
    SlotConflictError,
    create_booking,
    get_booking_by_uid,
    cancel_booking_by_token,
    _resolve_event_type,
)
from src.services.email_service import EmailService
from src.services.webhook_service import dispatch_webhooks_for_booking_task

router = APIRouter(
    prefix="/api/v1/public/calendar",
    tags=["calendar-public"],
)


@router.get(
    "/{org_slug}/{user_slug}/profile",
    response_model=PublicProfileResponse,
)
def get_public_profile(
    org_slug: str,
    user_slug: str,
    db: Session = Depends(get_db),
):
    """
    Perfil publico do host (usuario ou agente).
    user_slug: UUID do user_id ou agent_config_id para filtrar event types do host.
    """
    org = db.execute(
        select(Organization).where(Organization.slug == org_slug)
    ).scalars().one_or_none()
    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organizacao nao encontrada.",
        )

    event_types_list = db.execute(
        select(EventType).where(
            EventType.organization_id == org.id,
            EventType.is_active.is_(True),
            or_(
                EventType.user_id == user_slug,
                EventType.agent_config_id == user_slug,
            ),
        )
    ).scalars().all()
    event_types = list(event_types_list)

    if not event_types:
        raise HTTPException(
            status_code=404,
            detail="Perfil nao encontrado ou sem tipos de evento ativos.",
        )

    et_first = event_types[0]
    host_name = "Host"
    host_type = "user"
    avatar_url = None
    bio = None

    if et_first.agent_config_id:
        host_type = "agent"
        agent = db.execute(
            select(AgentConfig).where(
                AgentConfig.id == et_first.agent_config_id
            )
        ).scalars().one_or_none()
        if agent:
            host_name = agent.name
            avatar_url = agent.image_url
            bio = agent.description
    elif et_first.user_id:
        user = get_user_by_id(et_first.user_id)
        if user and getattr(user, "name", None):
            host_name = (user.name or "").strip() or "Host"

    event_type_items = []
    for et in event_types:
        locations = [
            LocationResponse(
                id=loc.id,
                location_type=(
                    loc.location_type.value
                    if hasattr(loc.location_type, "value")
                    else str(loc.location_type)
                ),
                location_value=loc.location_value,
                position=loc.position,
            )
            for loc in (getattr(et, "locations") or [])
        ]
        event_type_items.append(
            PublicEventTypeItem(
                slug=et.slug,
                title=et.title,
                description=et.description,
                duration_minutes=et.duration_minutes,
                locations=locations,
            )
        )

    return PublicProfileResponse(
        host_name=host_name,
        host_type=host_type,
        avatar_url=avatar_url,
        bio=bio,
        org_name=org.name,
        org_avatar_url=org.avatar_url,
        event_types=event_type_items,
    )


@router.get(
    "/{org_slug}/{event_slug}/slots",
    response_model=AvailableSlotsResponse,
)
def get_public_slots(
    org_slug: str,
    event_slug: str,
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    timezone: str = Query(default="America/Sao_Paulo"),
    db: Session = Depends(get_db),
):
    """Slots disponiveis para um tipo de evento (publico)."""
    event_type = _resolve_event_type(db, org_slug, event_slug)
    year, month_num = map(int, month.split("-"))
    date_from = date(year, month_num, 1)
    if month_num == 12:
        date_to = date(year, 12, 31)
    else:
        date_to = date(year, month_num + 1, 1) - timedelta(days=1)

    engine = AvailabilityEngine(db)
    days_raw = engine.get_available_slots(
        event_type_id=event_type.id,
        date_from=date_from,
        date_to=date_to,
        requester_timezone=timezone,
    )

    days = [
        DaySlotsResponse(
            date=d["date"],
            slots=[
                SlotResponse(
                    time=s["time"],
                    duration_minutes=s.get("duration_minutes", event_type.duration_minutes),
                )
                for s in d.get("slots", [])
            ],
        )
        for d in days_raw
    ]

    event_type_response = EventTypeResponse.from_orm_row(event_type)
    return AvailableSlotsResponse(
        event_type=event_type_response,
        timezone=timezone,
        days=days,
    )


def _send_booking_emails_task(booking_id: str, base_url: str = "") -> None:
    """Background task: envia emails de confirmacao (guest) via Resend."""
    db = SessionLocal()
    try:
        booking = db.execute(
            select(Booking).where(Booking.id == booking_id)
        ).scalars().one_or_none()
        if not booking:
            return
        event_type = db.execute(
            select(EventType).where(EventType.id == booking.event_type_id)
        ).scalars().one_or_none()
        if not event_type:
            return
        email_svc = EmailService(db)
        email_svc.send_booking_confirmation_to_guest(
            booking, event_type, base_url=base_url
        )
    finally:
        db.close()


@router.post(
    "/bookings",
    response_model=BookingPublicResponse,
    status_code=201,
)
def post_public_booking(
    request: Request,
    body: BookingCreatePublic,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Cria uma reserva (publico). Retorna 409 se o slot nao estiver mais disponivel."""
    try:
        booking = create_booking(db, body)
    except SlotConflictError as e:
        raise HTTPException(status_code=409, detail=e.message)

    base_url = str(request.base_url).rstrip("/")
    background_tasks.add_task(_send_booking_emails_task, str(booking.id), base_url)
    background_tasks.add_task(dispatch_webhooks_for_booking_task, str(booking.id), "booking.created")

    event_type = db.execute(
        select(EventType).where(EventType.id == booking.event_type_id)
    ).scalars().one_or_none()
    event_title = event_type.title if event_type else ""

    host_name = "Host"
    if booking.host_agent_config_id and event_type:
        agent = db.execute(
            select(AgentConfig).where(
                AgentConfig.id == booking.host_agent_config_id
            )
        ).scalars().one_or_none()
        if agent:
            host_name = agent.name

    return BookingPublicResponse(
        uid=booking.uid,
        event_title=event_title,
        host_name=host_name,
        guest_name=booking.guest_name,
        guest_email=booking.guest_email,
        start_time=booking.start_time.isoformat(),
        end_time=booking.end_time.isoformat(),
        duration_minutes=booking.duration_minutes,
        timezone=booking.timezone,
        status=(
            booking.status.value
            if hasattr(booking.status, "value")
            else str(booking.status)
        ),
        meeting_url=booking.meeting_url,
        cancel_token=booking.cancel_token,
    )


@router.get(
    "/bookings/{uid}",
    response_model=BookingPublicResponse,
)
def get_public_booking(
    uid: str,
    db: Session = Depends(get_db),
):
    """Detalhes de uma reserva pelo UID (publico)."""
    booking = get_booking_by_uid(db, uid)
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Reserva nao encontrada.",
        )

    event_type = db.execute(
        select(EventType).where(EventType.id == booking.event_type_id)
    ).scalars().one_or_none()
    event_title = event_type.title if event_type else ""

    host_name = "Host"
    if booking.host_agent_config_id:
        agent = db.execute(
            select(AgentConfig).where(
                AgentConfig.id == booking.host_agent_config_id
            )
        ).scalars().one_or_none()
        if agent:
            host_name = agent.name

    return BookingPublicResponse(
        uid=booking.uid,
        event_title=event_title,
        host_name=host_name,
        guest_name=booking.guest_name,
        guest_email=booking.guest_email,
        start_time=booking.start_time.isoformat(),
        end_time=booking.end_time.isoformat(),
        duration_minutes=booking.duration_minutes,
        timezone=booking.timezone,
        status=(
            booking.status.value
            if hasattr(booking.status, "value")
            else str(booking.status)
        ),
        meeting_url=booking.meeting_url,
        cancel_token=booking.cancel_token,
    )


@router.post(
    "/bookings/{uid}/cancel",
    status_code=200,
)
def post_public_booking_cancel(
    uid: str,
    body: BookingCancelPublic,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Cancela uma reserva pelo guest (token obrigatorio)."""
    booking = cancel_booking_by_token(
        db, uid, body.cancel_token, reason=body.reason
    )
    background_tasks.add_task(
        dispatch_webhooks_for_booking_task, str(booking.id), "booking.cancelled"
    )
    return {"status": "cancelled"}
