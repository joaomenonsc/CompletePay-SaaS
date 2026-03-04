"""Rotas CRM: Agendamentos (Epic 4). Requer JWT + X-Organization-Id."""
import logging
import urllib.parse
from datetime import date, datetime, timedelta, time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.api.deps import require_organization_id, require_org_role
from src.api.middleware.auth import require_user_id
from src.cache import cache_get_sync, cache_set_sync, cache_invalidate_prefix_sync, make_cache_key
from src.db.models_calendar import Booking, BookingStatus, EventType
from src.db.models_crm import Appointment, HealthProfessional, Patient
from src.db.session import get_db
from src.schemas.crm import (
    APPOINTMENT_STATUS_TRANSITIONS,
    AppointmentCreate,
    AppointmentListItemResponse,
    AppointmentListResponse,
    AppointmentRescheduleBody,
    AppointmentResponse,
    AppointmentUpdateStatus,
)
from src.services.availability_engine import AvailabilityEngine
from src.services.booking_service import (
    SlotConflictError,
    cancel_booking_by_host,
    create_booking_from_crm,
    mark_booking_no_show,
)

logger = logging.getLogger("completepay.crm")

router = APIRouter(prefix="/appointments", tags=["crm-appointments"])

ROLES_READ = ["rcp", "fin", "enf", "med", "gcl", "mkt"]
ROLES_WRITE = ["rcp", "gcl"]


def _base_filters(
    organization_id: str,
    patient_id: Optional[str],
    professional_id: Optional[str],
    date_from: Optional[date],
    date_to: Optional[date],
):
    """Retorna lista de condições para filtro de appointments."""
    conditions = [Appointment.organization_id == organization_id]
    if patient_id:
        conditions.append(Appointment.patient_id == patient_id)
    if professional_id:
        conditions.append(Appointment.professional_id == professional_id)
    if date_from is not None:
        conditions.append(Appointment.start_time >= datetime.combine(date_from, time(0, 0)))
    if date_to is not None:
        next_day = date_to + timedelta(days=1)
        conditions.append(Appointment.start_time < datetime.combine(next_day, time(0, 0)))
    return conditions


@router.get("/available-slots")
def get_available_slots(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
    event_type_id: str = Query(..., description="EventType do profissional (consulta)"),
    date_from: date = Query(..., description="Data inicial"),
    date_to: date = Query(..., description="Data final"),
    timezone: str = Query("America/Sao_Paulo", description="Timezone do requester"),
):
    """Retorna slots disponiveis para o event_type (agenda do profissional)."""
    et = db.execute(
        select(EventType).where(
            EventType.id == event_type_id,
            EventType.organization_id == organization_id,
            EventType.is_active.is_(True),
        )
    ).scalars().one_or_none()
    if not et:
        raise HTTPException(status_code=404, detail="Tipo de evento nao encontrado ou inativo.")
    engine = AvailabilityEngine(db)
    slots_data = engine.get_available_slots(
        event_type_id=event_type_id,
        date_from=date_from,
        date_to=date_to,
        requester_timezone=timezone,
    )
    return {"slots": slots_data}


@router.get("", response_model=AppointmentListResponse)
def list_appointments(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    patient_id: Optional[str] = Query(None, description="Filtrar por paciente"),
    professional_id: Optional[str] = Query(None, description="Filtrar por profissional"),
    date_from: Optional[date] = Query(None, description="Data inicial (inclusive)"),
    date_to: Optional[date] = Query(None, description="Data final (inclusive)"),
):
    """Lista agendamentos com filtros e paginacao."""
    cache_key = make_cache_key(
        "crm:appointments", organization_id,
        patient_id=patient_id or "", professional_id=professional_id or "",
        date_from=str(date_from), date_to=str(date_to), limit=limit, offset=offset,
    )
    if cached := cache_get_sync(cache_key):
        return cached

    conditions = _base_filters(organization_id, patient_id, professional_id, date_from, date_to)
    total = db.execute(select(func.count()).select_from(Appointment).where(*conditions)).scalar() or 0
    rows = (
        db.execute(
            select(
                Appointment,
                Patient.full_name.label("patient_name"),
                HealthProfessional.full_name.label("professional_name"),
            )
            .join(Patient, Appointment.patient_id == Patient.id)
            .join(HealthProfessional, Appointment.professional_id == HealthProfessional.id)
            .where(*conditions)
            .order_by(Appointment.start_time.desc())
            .offset(offset)
            .limit(limit)
        )
        .all()
    )
    items = [
        AppointmentListItemResponse(
            id=r.Appointment.id,
            booking_id=r.Appointment.booking_id,
            patient_id=r.Appointment.patient_id,
            professional_id=r.Appointment.professional_id,
            patient_name=r.patient_name,
            professional_name=r.professional_name,
            unit_id=r.Appointment.unit_id,
            room_id=r.Appointment.room_id,
            status=r.Appointment.status,
            appointment_type=r.Appointment.appointment_type,
            start_time=r.Appointment.start_time,
            end_time=r.Appointment.end_time,
        )
        for r in rows
    ]
    result = AppointmentListResponse(items=items, total=total, limit=limit, offset=offset)
    cache_set_sync(cache_key, result.model_dump(mode="json"), ttl=30)
    return result


@router.get("/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Detalhe de um agendamento."""
    appointment = db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado.")
    return AppointmentResponse.model_validate(appointment)


@router.post("", response_model=AppointmentResponse, status_code=201)
def create_appointment(
    body: AppointmentCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria agendamento: Booking (calendario) + Appointment (CRM)."""
    patient = db.execute(
        select(Patient).where(
            Patient.id == body.patient_id,
            Patient.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")

    guest_name = patient.full_name or "Paciente"
    guest_email = patient.email or (f"paciente-{patient.id}@placeholder.local")
    if not patient.email and not guest_email:
        raise HTTPException(
            status_code=400,
            detail="Paciente precisa de e-mail para agendamento.",
        )

    try:
        booking = create_booking_from_crm(
            db,
            event_type_id=body.event_type_id,
            organization_id=organization_id,
            guest_name=guest_name,
            guest_email=guest_email,
            start_time=body.start_time,
            timezone=body.timezone,
            guest_notes=body.notes,
            duration_minutes=None,
        )
    except SlotConflictError as e:
        raise HTTPException(status_code=409, detail=e.message)

    # start_time/end_time no Appointment espelham o Booking (já em UTC no objeto)
    appointment = Appointment(
        organization_id=organization_id,
        booking_id=booking.id,
        patient_id=body.patient_id,
        professional_id=body.professional_id,
        unit_id=body.unit_id,
        room_id=body.room_id,
        status="agendado",
        appointment_type=body.appointment_type,
        start_time=booking.start_time,
        end_time=booking.end_time,
        notes=body.notes,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    # Invalida cache de agendamentos e dashboard financeiro
    cache_invalidate_prefix_sync(f"crm:appointments:{organization_id}")
    cache_invalidate_prefix_sync(f"crm:financial:dashboard:{organization_id}")
    logger.info("Appointment criado: %s (booking=%s)", appointment.id, booking.id)
    return AppointmentResponse.model_validate(appointment)


def _get_appointment_and_booking(
    db: Session, appointment_id: str, organization_id: str
) -> tuple[Appointment, Booking | None]:
    """Retorna (appointment, booking) ou levanta 404."""
    appointment = db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado.")
    booking = db.execute(
        select(Booking).where(
            Booking.id == appointment.booking_id,
            Booking.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    return appointment, booking


@router.patch("/{appointment_id}", response_model=AppointmentResponse)
def update_appointment_status(
    appointment_id: str,
    body: AppointmentUpdateStatus,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza status do agendamento (confirmar, cancelar, no-show, em atendimento, atendido)."""
    appointment, booking = _get_appointment_and_booking(db, appointment_id, organization_id)
    current = (appointment.status or "").strip().lower()
    new_status = body.status.strip().lower()
    allowed = APPOINTMENT_STATUS_TRANSITIONS.get(current, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transicao de status invalida: {current} -> {new_status}. Permitido: {allowed}",
        )

    if new_status == "cancelado":
        reason = (body.cancellation_reason or "").strip() or "Cancelado pelo usuario"
        cancel_booking_by_host(db, appointment.booking_id, organization_id, reason=reason)
        appointment.status = "cancelado"
    elif new_status == "no_show":
        mark_booking_no_show(db, appointment.booking_id, organization_id)
        appointment.status = "no_show"
    elif new_status == "confirmado" and booking:
        booking.status = BookingStatus.confirmed
        appointment.status = "confirmado"
    elif new_status == "em_atendimento":
        appointment.status = "em_atendimento"
    elif new_status == "atendido" and booking:
        booking.status = BookingStatus.completed
        appointment.status = "atendido"

    db.commit()
    db.refresh(appointment)
    # Invalida cache de agendamentos e dashboard financeiro
    cache_invalidate_prefix_sync(f"crm:appointments:{organization_id}")
    cache_invalidate_prefix_sync(f"crm:financial:dashboard:{organization_id}")
    logger.info("Appointment %s status -> %s", appointment_id, new_status)
    return AppointmentResponse.model_validate(appointment)


@router.post("/{appointment_id}/reschedule", response_model=AppointmentResponse, status_code=201)
def reschedule_appointment(
    appointment_id: str,
    body: AppointmentRescheduleBody,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Remarca: cria novo agendamento no horario indicado e cancela o anterior."""
    appointment, _ = _get_appointment_and_booking(db, appointment_id, organization_id)
    current = (appointment.status or "").strip().lower()
    if current not in ("agendado", "confirmado"):
        raise HTTPException(
            status_code=400,
            detail="So e possivel remarcar agendamentos com status agendado ou confirmado.",
        )

    patient = db.execute(
        select(Patient).where(
            Patient.id == appointment.patient_id,
            Patient.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")

    professional = db.execute(
        select(HealthProfessional).where(
            HealthProfessional.id == appointment.professional_id,
            HealthProfessional.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not professional or not professional.event_type_id:
        raise HTTPException(
            status_code=400,
            detail="Profissional sem tipo de evento configurado para consulta.",
        )

    guest_name = patient.full_name or "Paciente"
    guest_email = patient.email or (f"paciente-{patient.id}@placeholder.local")
    try:
        new_booking = create_booking_from_crm(
            db,
            event_type_id=professional.event_type_id,
            organization_id=organization_id,
            guest_name=guest_name,
            guest_email=guest_email,
            start_time=body.start_time,
            timezone=body.timezone,
            guest_notes=appointment.notes,
            duration_minutes=None,
        )
    except SlotConflictError as e:
        raise HTTPException(status_code=409, detail=e.message)

    old_booking_id = appointment.booking_id
    new_appointment = Appointment(
        organization_id=organization_id,
        booking_id=new_booking.id,
        patient_id=appointment.patient_id,
        professional_id=appointment.professional_id,
        unit_id=appointment.unit_id,
        room_id=appointment.room_id,
        status="agendado",
        appointment_type=appointment.appointment_type,
        start_time=new_booking.start_time,
        end_time=new_booking.end_time,
        notes=appointment.notes,
    )
    db.add(new_appointment)
    appointment.status = "cancelado"
    db.commit()
    db.refresh(new_appointment)
    # Invalida cache de agendamentos e dashboard financeiro
    cache_invalidate_prefix_sync(f"crm:appointments:{organization_id}")
    cache_invalidate_prefix_sync(f"crm:financial:dashboard:{organization_id}")

    cancel_booking_by_host(
        db, old_booking_id, organization_id, reason="Remarcado para novo horario."
    )
    logger.info(
        "Remarcado: appointment %s cancelado, novo %s (booking=%s)",
        appointment_id, new_appointment.id, new_booking.id,
    )
    return AppointmentResponse.model_validate(new_appointment)


def _normalize_phone_whatsapp(phone: str | None) -> str:
    """Remove nao-digitios e adiciona 55 (Brasil) se necessario."""
    if not phone or not phone.strip():
        return ""
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) >= 10:
        return "55" + digits if not digits.startswith("55") else digits
    return ""


@router.get("/{appointment_id}/reminder")
def get_appointment_reminder(
    appointment_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Epic 4.4: Retorna link wa.me para lembrete e telefone do paciente."""
    appointment = db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado.")
    patient = db.execute(
        select(Patient).where(
            Patient.id == appointment.patient_id,
            Patient.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")
    professional = db.execute(
        select(HealthProfessional).where(
            HealthProfessional.id == appointment.professional_id,
        )
    ).scalars().one_or_none()
    pro_name = professional.full_name if professional else "Profissional"
    start = appointment.start_time
    date_str = start.strftime("%d/%m/%Y") if start else ""
    time_str = start.strftime("%H:%M") if start else ""
    msg = (
        f"Olá! Lembrete: você tem uma consulta agendada com {pro_name} "
        f"no dia {date_str} às {time_str}. Confirme sua presença."
    )
    encoded = urllib.parse.quote(msg)
    phone = _normalize_phone_whatsapp(patient.phone)
    whatsapp_link = f"https://wa.me/{phone}?text={encoded}" if phone else ""
    return {"whatsapp_link": whatsapp_link, "patient_phone": patient.phone or None}
