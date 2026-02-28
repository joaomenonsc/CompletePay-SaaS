"""Rotas CRM: Financeiro (pagamentos, recibos) e dashboard. Epic 6."""
import logging
from datetime import date, datetime, timedelta, time, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from src.api.deps import require_organization_id, require_org_role
from src.api.middleware.auth import require_user_id
from src.db.models_crm import (
    ClinicalEncounter,
    HealthProfessional,
    Patient,
    Payment,
    Appointment,
)
from src.db.session import get_db
from src.schemas.crm import (
    DashboardMetricsResponse,
    PaymentCreate,
    PaymentListItemResponse,
    PaymentResponse,
)
from src.services.audit_service import log_audit

logger = logging.getLogger("completepay.crm")

router = APIRouter(prefix="/financial", tags=["crm-financial"])

ROLES_FIN_READ = ["enf", "med", "gcl"]
ROLES_FIN_WRITE = ["med", "gcl"]


def _payment_to_response(
    p: Payment,
    patient_name: Optional[str] = None,
    professional_name: Optional[str] = None,
    encounter_created_at: Optional[datetime] = None,
) -> PaymentListItemResponse:
    amount = float(p.amount) if isinstance(p.amount, Decimal) else p.amount
    return PaymentListItemResponse(
        id=p.id,
        organization_id=p.organization_id,
        encounter_id=p.encounter_id,
        amount=amount,
        payment_method=p.payment_method,
        notes=p.notes,
        paid_at=p.paid_at,
        recorded_by=p.recorded_by,
        created_at=p.created_at,
        patient_name=patient_name,
        professional_name=professional_name,
        encounter_created_at=encounter_created_at,
    )


@router.get("/payments", response_model=dict)
def list_payments(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_FIN_READ)),
    db: Session = Depends(get_db),
    encounter_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Lista pagamentos com filtros. Inclui nome do paciente e profissional."""
    q = (
        select(
            Payment,
            Patient.full_name.label("patient_name"),
            HealthProfessional.full_name.label("professional_name"),
            ClinicalEncounter.created_at.label("encounter_created_at"),
        )
        .join(ClinicalEncounter, Payment.encounter_id == ClinicalEncounter.id)
        .join(Patient, ClinicalEncounter.patient_id == Patient.id)
        .join(HealthProfessional, ClinicalEncounter.professional_id == HealthProfessional.id)
        .where(Payment.organization_id == organization_id)
    )
    if encounter_id:
        q = q.where(Payment.encounter_id == encounter_id)
    if date_from is not None:
        q = q.where(Payment.paid_at >= datetime.combine(date_from, time(0, 0), tzinfo=timezone.utc))
    if date_to is not None:
        next_day = date_to + timedelta(days=1)
        q = q.where(Payment.paid_at < datetime.combine(next_day, time(0, 0), tzinfo=timezone.utc))
    q = q.order_by(Payment.paid_at.desc()).offset(offset).limit(limit)
    rows = db.execute(q).all()
    items = [
        _payment_to_response(
            r[0],
            patient_name=r[1],
            professional_name=r[2],
            encounter_created_at=r[3],
        )
        for r in rows
    ]
    count_q = select(func.count()).select_from(Payment).where(Payment.organization_id == organization_id)
    if encounter_id:
        count_q = count_q.where(Payment.encounter_id == encounter_id)
    if date_from is not None:
        count_q = count_q.where(Payment.paid_at >= datetime.combine(date_from, time(0, 0), tzinfo=timezone.utc))
    if date_to is not None:
        next_day = date_to + timedelta(days=1)
        count_q = count_q.where(Payment.paid_at < datetime.combine(next_day, time(0, 0), tzinfo=timezone.utc))
    total = db.execute(count_q).scalar() or 0
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_FIN_READ)),
    db: Session = Depends(get_db),
):
    """Detalhe de um pagamento."""
    p = db.execute(
        select(Payment).where(
            Payment.id == payment_id,
            Payment.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pagamento nao encontrado.")
    amount = float(p.amount) if isinstance(p.amount, Decimal) else p.amount
    return PaymentResponse(
        id=p.id,
        organization_id=p.organization_id,
        encounter_id=p.encounter_id,
        amount=amount,
        payment_method=p.payment_method,
        notes=p.notes,
        paid_at=p.paid_at,
        recorded_by=p.recorded_by,
        created_at=p.created_at,
    )


@router.get("/payments/{payment_id}/receipt", response_class=Response)
def get_payment_receipt_pdf(
    payment_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_FIN_READ)),
    db: Session = Depends(get_db),
):
    """Gera o PDF de recibo de pagamento."""
    from src.services.pdf_service import generate_payment_receipt_pdf
    from src.db.models import Organization

    p = db.execute(
        select(Payment).where(
            Payment.id == payment_id,
            Payment.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pagamento nao encontrado.")

    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == p.encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one()

    org = db.execute(select(Organization).where(Organization.id == organization_id)).scalars().one()
    patient = db.execute(select(Patient).where(Patient.id == encounter.patient_id)).scalars().one()
    professional = db.execute(select(HealthProfessional).where(HealthProfessional.id == encounter.professional_id)).scalars().one()

    pdf_bytes = generate_payment_receipt_pdf(p, patient, professional, org)
    
    headers = {
        "Content-Disposition": f"attachment; filename=Recibo - {patient.full_name}.pdf"
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)



@router.get("/encounters/{encounter_id}/payment", response_model=PaymentResponse)
def get_payment_by_encounter(
    encounter_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_FIN_READ)),
    db: Session = Depends(get_db),
):
    """Retorna o pagamento do atendimento. 404 se ainda nao houver pagamento."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    p = db.execute(
        select(Payment).where(
            Payment.encounter_id == encounter_id,
            Payment.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Nenhum pagamento registrado para este atendimento.")
    amount = float(p.amount) if isinstance(p.amount, Decimal) else p.amount
    return PaymentResponse(
        id=p.id,
        organization_id=p.organization_id,
        encounter_id=p.encounter_id,
        amount=amount,
        payment_method=p.payment_method,
        notes=p.notes,
        paid_at=p.paid_at,
        recorded_by=p.recorded_by,
        created_at=p.created_at,
    )


@router.post("/payments", response_model=PaymentResponse, status_code=201)
def create_payment(
    body: PaymentCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_FIN_WRITE)),
    db: Session = Depends(get_db),
):
    """Registra pagamento para um atendimento. Um atendimento pode ter apenas um pagamento (sobrescreve se enviar de novo)."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == body.encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    existing = db.execute(
        select(Payment).where(
            Payment.encounter_id == body.encounter_id,
            Payment.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Este atendimento ja possui um pagamento registrado.",
        )
    payment = Payment(
        organization_id=organization_id,
        encounter_id=body.encounter_id,
        amount=body.amount,
        payment_method=body.payment_method or "pix",
        notes=body.notes,
        recorded_by=user_id,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    log_audit(
        db, organization_id, user_id,
        action="create", resource_type="payment", resource_id=payment.id,
        data_classification="FIN", data_after={"amount": body.amount, "encounter_id": body.encounter_id},
    )
    amount = float(payment.amount) if isinstance(payment.amount, Decimal) else payment.amount
    return PaymentResponse(
        id=payment.id,
        organization_id=payment.organization_id,
        encounter_id=payment.encounter_id,
        amount=amount,
        payment_method=payment.payment_method,
        notes=payment.notes,
        paid_at=payment.paid_at,
        recorded_by=payment.recorded_by,
        created_at=payment.created_at,
    )


@router.get("/dashboard", response_model=DashboardMetricsResponse)
def get_dashboard_metrics(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_FIN_READ)),
    db: Session = Depends(get_db),
):
    """Metricas para o dashboard CRM: consultas do dia, pagamentos, pacientes."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today_start.replace(day=1)
    tomorrow_start = today_start + timedelta(days=1)

    encounters_today = db.execute(
        select(func.count()).select_from(ClinicalEncounter).where(
            ClinicalEncounter.organization_id == organization_id,
            ClinicalEncounter.created_at >= today_start,
            ClinicalEncounter.created_at < tomorrow_start,
        )
    ).scalar() or 0

    encounters_completed_today = db.execute(
        select(func.count()).select_from(ClinicalEncounter).where(
            ClinicalEncounter.organization_id == organization_id,
            ClinicalEncounter.status == "completed",
            ClinicalEncounter.updated_at >= today_start,
            ClinicalEncounter.updated_at < tomorrow_start,
        )
    ).scalar() or 0

    payments_today = db.execute(
        select(func.count(), func.coalesce(func.sum(Payment.amount), 0)).select_from(Payment).where(
            Payment.organization_id == organization_id,
            Payment.paid_at >= today_start,
            Payment.paid_at < tomorrow_start,
        )
    ).first()
    payments_today_count = payments_today[0] or 0
    payments_today_total = float(payments_today[1] or 0)

    payments_month = db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).select_from(Payment).where(
            Payment.organization_id == organization_id,
            Payment.paid_at >= month_start,
            Payment.paid_at <= now,
        )
    ).scalar()
    payments_month_total = float(payments_month or 0)

    patients_total = db.execute(
        select(func.count()).select_from(Patient).where(Patient.organization_id == organization_id)
    ).scalar() or 0

    appointments_today = db.execute(
        select(func.count()).select_from(Appointment).where(
            Appointment.organization_id == organization_id,
            Appointment.start_time >= today_start,
            Appointment.start_time < tomorrow_start,
        )
    ).scalar() or 0

    return DashboardMetricsResponse(
        encounters_today=encounters_today,
        encounters_completed_today=encounters_completed_today,
        payments_today_count=payments_today_count,
        payments_today_total=payments_today_total,
        payments_month_total=payments_month_total,
        patients_total=patients_total,
        appointments_today=appointments_today,
    )
