"""Rotas CRM: Lista de espera (Epic 4.5)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.deps import require_organization_id, require_org_role
from src.api.middleware.auth import require_user_id
from src.db.models_crm import HealthProfessional, Patient, WaitlistEntry
from src.db.session import get_db
from src.schemas.crm import WaitlistEntryCreate, WaitlistEntryResponse

router = APIRouter(prefix="/waitlist", tags=["crm-waitlist"])

ROLES_READ = ["rcp", "fin", "enf", "med", "gcl", "mkt"]
ROLES_WRITE = ["rcp", "gcl"]


@router.get("", response_model=list[WaitlistEntryResponse])
def list_waitlist(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
    professional_id: str | None = Query(None),
    status: str | None = Query(None, description="waiting, scheduled, expired, cancelled"),
):
    """Lista entradas da lista de espera com filtros."""
    q = (
        select(
            WaitlistEntry,
            Patient.full_name.label("patient_name"),
            HealthProfessional.full_name.label("professional_name"),
        )
        .join(Patient, WaitlistEntry.patient_id == Patient.id)
        .join(HealthProfessional, WaitlistEntry.professional_id == HealthProfessional.id)
        .where(WaitlistEntry.organization_id == organization_id)
    )
    if professional_id:
        q = q.where(WaitlistEntry.professional_id == professional_id)
    if status:
        q = q.where(WaitlistEntry.status == status)
    q = q.order_by(WaitlistEntry.priority.desc(), WaitlistEntry.created_at.asc())
    rows = db.execute(q).all()
    return [
        WaitlistEntryResponse(
            id=r.WaitlistEntry.id,
            organization_id=r.WaitlistEntry.organization_id,
            patient_id=r.WaitlistEntry.patient_id,
            professional_id=r.WaitlistEntry.professional_id,
            appointment_type=r.WaitlistEntry.appointment_type,
            preferred_dates=r.WaitlistEntry.preferred_dates or None,
            priority=r.WaitlistEntry.priority,
            status=r.WaitlistEntry.status,
            created_at=r.WaitlistEntry.created_at,
            patient_name=r.patient_name,
            professional_name=r.professional_name,
        )
        for r in rows
    ]


@router.post("", response_model=WaitlistEntryResponse, status_code=201)
def create_waitlist_entry(
    body: WaitlistEntryCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Adiciona paciente à lista de espera."""
    patient = db.execute(
        select(Patient).where(
            Patient.id == body.patient_id,
            Patient.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")
    professional = db.execute(
        select(HealthProfessional).where(
            HealthProfessional.id == body.professional_id,
            HealthProfessional.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not professional:
        raise HTTPException(status_code=404, detail="Profissional nao encontrado.")
    entry = WaitlistEntry(
        organization_id=organization_id,
        patient_id=body.patient_id,
        professional_id=body.professional_id,
        appointment_type=body.appointment_type,
        preferred_dates=body.preferred_dates,
        priority=body.priority,
        status="waiting",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return WaitlistEntryResponse(
        id=entry.id,
        organization_id=entry.organization_id,
        patient_id=entry.patient_id,
        professional_id=entry.professional_id,
        appointment_type=entry.appointment_type,
        preferred_dates=entry.preferred_dates,
        priority=entry.priority,
        status=entry.status,
        created_at=entry.created_at,
        patient_name=patient.full_name,
        professional_name=professional.full_name,
    )


@router.patch("/{entry_id}", response_model=WaitlistEntryResponse)
def update_waitlist_entry_status(
    entry_id: str,
    status: str = Query(..., pattern="^(waiting|scheduled|expired|cancelled)$"),
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza status da entrada (ex.: scheduled quando encaixado, cancelled)."""
    entry = db.execute(
        select(WaitlistEntry).where(
            WaitlistEntry.id == entry_id,
            WaitlistEntry.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrada nao encontrada.")
    entry.status = status
    db.commit()
    db.refresh(entry)
    row = db.execute(
        select(
            WaitlistEntry,
            Patient.full_name.label("patient_name"),
            HealthProfessional.full_name.label("professional_name"),
        )
        .join(Patient, WaitlistEntry.patient_id == Patient.id)
        .join(HealthProfessional, WaitlistEntry.professional_id == HealthProfessional.id)
        .where(WaitlistEntry.id == entry_id)
    ).one()
    return WaitlistEntryResponse(
        id=row.WaitlistEntry.id,
        organization_id=row.WaitlistEntry.organization_id,
        patient_id=row.WaitlistEntry.patient_id,
        professional_id=row.WaitlistEntry.professional_id,
        appointment_type=row.WaitlistEntry.appointment_type,
        preferred_dates=row.WaitlistEntry.preferred_dates,
        priority=row.WaitlistEntry.priority,
        status=row.WaitlistEntry.status,
        created_at=row.WaitlistEntry.created_at,
        patient_name=row.patient_name,
        professional_name=row.professional_name,
    )
