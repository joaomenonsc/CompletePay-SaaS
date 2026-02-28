"""Rotas CRM: Atendimento clinico (triagem, evolucao). Epic 5. Requer JWT + X-Organization-Id."""
import logging
from datetime import date, datetime, timedelta, time, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.api.deps import require_organization_id, require_org_role
from src.api.middleware.auth import require_user_id
from src.db.models_crm import (
    Appointment,
    ClinicalEncounter,
    ClinicalEvolution,
    ExamRequest,
    ExamRequestItem,
    HealthProfessional,
    Patient,
    Prescription,
    PrescriptionItem,
    Triage,
)
from src.db.session import get_db
from src.schemas.crm import (
    ClinicalEncounterCreate,
    ClinicalEncounterResponse,
    ClinicalEvolutionCreate,
    ClinicalEvolutionResponse,
    ClinicalEvolutionUpdate,
    ExamRequestCreate,
    ExamRequestItemResponse,
    ExamRequestResponse,
    ExamRequestUpdate,
    PrescriptionCreate,
    PrescriptionItemResponse,
    PrescriptionResponse,
    PrescriptionUpdate,
    TriageCreate,
    TriageResponse,
)
from src.services.audit_service import log_audit

logger = logging.getLogger("completepay.crm")

router = APIRouter(prefix="/clinical", tags=["crm-clinical"])

ROLES_CLI = ["enf", "med", "gcl"]


@router.get("/encounters", response_model=list[ClinicalEncounterResponse])
def list_encounters(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
    patient_id: Optional[str] = Query(None),
    professional_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Lista atendimentos (encounters) com filtros."""
    q = (
        select(
            ClinicalEncounter,
            Patient.full_name.label("patient_name"),
            HealthProfessional.full_name.label("professional_name"),
        )
        .join(Patient, ClinicalEncounter.patient_id == Patient.id)
        .join(HealthProfessional, ClinicalEncounter.professional_id == HealthProfessional.id)
        .where(ClinicalEncounter.organization_id == organization_id)
    )
    if patient_id:
        q = q.where(ClinicalEncounter.patient_id == patient_id)
    if professional_id:
        q = q.where(ClinicalEncounter.professional_id == professional_id)
    if status:
        q = q.where(ClinicalEncounter.status == status)
    if date_from is not None:
        q = q.where(ClinicalEncounter.created_at >= datetime.combine(date_from, time(0, 0)))
    if date_to is not None:
        next_day = date_to + timedelta(days=1)
        q = q.where(ClinicalEncounter.created_at < datetime.combine(next_day, time(0, 0)))
    q = q.order_by(ClinicalEncounter.created_at.desc()).offset(offset).limit(limit)
    rows = db.execute(q).all()
    return [
        ClinicalEncounterResponse(
            id=r.ClinicalEncounter.id,
            organization_id=r.ClinicalEncounter.organization_id,
            appointment_id=r.ClinicalEncounter.appointment_id,
            patient_id=r.ClinicalEncounter.patient_id,
            professional_id=r.ClinicalEncounter.professional_id,
            unit_id=r.ClinicalEncounter.unit_id,
            status=r.ClinicalEncounter.status,
            created_at=r.ClinicalEncounter.created_at,
            updated_at=r.ClinicalEncounter.updated_at,
            patient_name=r.patient_name,
            professional_name=r.professional_name,
        )
        for r in rows
    ]


@router.post("/encounters", response_model=ClinicalEncounterResponse, status_code=201)
def create_encounter(
    body: ClinicalEncounterCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Cria atendimento. Se appointment_id for informado, valida e usa dados do agendamento."""
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

    appointment_id = body.appointment_id
    unit_id = body.unit_id
    if appointment_id:
        apt = db.execute(
            select(Appointment).where(
                Appointment.id == appointment_id,
                Appointment.organization_id == organization_id,
            )
        ).scalars().one_or_none()
        if not apt:
            raise HTTPException(status_code=404, detail="Agendamento nao encontrado.")
        if apt.patient_id != body.patient_id or apt.professional_id != body.professional_id:
            raise HTTPException(
                status_code=400,
                detail="Paciente e profissional devem coincidir com o agendamento.",
            )
        if not unit_id:
            unit_id = apt.unit_id
        existing = db.execute(
            select(ClinicalEncounter).where(
                ClinicalEncounter.appointment_id == appointment_id,
                ClinicalEncounter.organization_id == organization_id,
            )
        ).scalars().one_or_none()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Ja existe atendimento para este agendamento.",
            )

    encounter = ClinicalEncounter(
        organization_id=organization_id,
        appointment_id=appointment_id,
        patient_id=body.patient_id,
        professional_id=body.professional_id,
        unit_id=unit_id,
        status="in_triage",
    )
    db.add(encounter)
    db.commit()
    db.refresh(encounter)
    log_audit(
        db, organization_id, user_id,
        action="create", resource_type="clinical_encounter", resource_id=encounter.id,
        data_classification="CLI", data_after={"status": encounter.status},
    )
    logger.info("Encounter criado: %s (appointment=%s)", encounter.id, appointment_id)
    return ClinicalEncounterResponse(
        id=encounter.id,
        organization_id=encounter.organization_id,
        appointment_id=encounter.appointment_id,
        patient_id=encounter.patient_id,
        professional_id=encounter.professional_id,
        unit_id=encounter.unit_id,
        status=encounter.status,
        created_at=encounter.created_at,
        updated_at=encounter.updated_at,
        patient_name=patient.full_name,
        professional_name=professional.full_name,
    )


@router.get("/encounters/{encounter_id}", response_model=ClinicalEncounterResponse)
def get_encounter(
    encounter_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Detalhe do atendimento."""
    row = db.execute(
        select(
            ClinicalEncounter,
            Patient.full_name.label("patient_name"),
            HealthProfessional.full_name.label("professional_name"),
        )
        .join(Patient, ClinicalEncounter.patient_id == Patient.id)
        .join(HealthProfessional, ClinicalEncounter.professional_id == HealthProfessional.id)
        .where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    e = row.ClinicalEncounter
    return ClinicalEncounterResponse(
        id=e.id,
        organization_id=e.organization_id,
        appointment_id=e.appointment_id,
        patient_id=e.patient_id,
        professional_id=e.professional_id,
        unit_id=e.unit_id,
        status=e.status,
        created_at=e.created_at,
        updated_at=e.updated_at,
        patient_name=row.patient_name,
        professional_name=row.professional_name,
    )


@router.patch("/encounters/{encounter_id}/status", response_model=ClinicalEncounterResponse)
def update_encounter_status(
    encounter_id: str,
    status: str = Query(..., pattern="^(in_triage|in_progress|completed|pending_docs)$"),
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Atualiza status do atendimento (in_triage, in_progress, completed, pending_docs)."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    old_status = encounter.status
    encounter.status = status
    db.commit()
    db.refresh(encounter)
    log_audit(
        db, organization_id, user_id,
        action="update", resource_type="clinical_encounter", resource_id=encounter_id,
        data_classification="CLI", data_before={"status": old_status}, data_after={"status": status},
    )
    row = db.execute(
        select(
            ClinicalEncounter,
            Patient.full_name.label("patient_name"),
            HealthProfessional.full_name.label("professional_name"),
        )
        .join(Patient, ClinicalEncounter.patient_id == Patient.id)
        .join(HealthProfessional, ClinicalEncounter.professional_id == HealthProfessional.id)
        .where(ClinicalEncounter.id == encounter_id)
    ).one()
    e = row.ClinicalEncounter
    return ClinicalEncounterResponse(
        id=e.id, organization_id=e.organization_id, appointment_id=e.appointment_id,
        patient_id=e.patient_id, professional_id=e.professional_id, unit_id=e.unit_id,
        status=e.status, created_at=e.created_at, updated_at=e.updated_at,
        patient_name=row.patient_name, professional_name=row.professional_name,
    )


def _triage_to_response(t: Triage) -> TriageResponse:
    def _to_list(v):
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, dict):
            return list(v.values()) if v else None
        return None
    return TriageResponse(
        id=t.id, encounter_id=t.encounter_id,
        chief_complaint=t.chief_complaint, symptom_onset=t.symptom_onset,
        allergies=_to_list(t.allergies), current_medications=_to_list(t.current_medications),
        past_conditions=_to_list(t.past_conditions),
        triage_notes=t.triage_notes, recorded_by=t.recorded_by, created_at=t.created_at,
    )


@router.get("/encounters/{encounter_id}/triage", response_model=TriageResponse | None)
def get_triage(
    encounter_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Retorna triagem do atendimento, se existir."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    triage = db.execute(
        select(Triage).where(Triage.encounter_id == encounter_id)
    ).scalars().one_or_none()
    if not triage:
        return None
    return _triage_to_response(triage)


@router.post("/encounters/{encounter_id}/triage", response_model=TriageResponse, status_code=201)
def create_or_update_triage(
    encounter_id: str,
    body: TriageCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Cria ou atualiza triagem do atendimento. Status do encounter permanece in_triage."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    existing = db.execute(select(Triage).where(Triage.encounter_id == encounter_id)).scalars().one_or_none()
    if existing:
        existing.chief_complaint = body.chief_complaint or existing.chief_complaint
        existing.symptom_onset = body.symptom_onset or existing.symptom_onset
        existing.allergies = body.allergies if body.allergies is not None else existing.allergies
        existing.current_medications = body.current_medications if body.current_medications is not None else existing.current_medications
        existing.past_conditions = body.past_conditions if body.past_conditions is not None else existing.past_conditions
        existing.triage_notes = body.triage_notes or existing.triage_notes
        existing.recorded_by = user_id
        db.commit()
        db.refresh(existing)
        log_audit(db, organization_id, user_id, action="update", resource_type="triage", resource_id=existing.id, data_classification="CLI")
        return _triage_to_response(existing)
    triage = Triage(
        encounter_id=encounter_id,
        chief_complaint=body.chief_complaint,
        symptom_onset=body.symptom_onset,
        allergies=body.allergies,
        current_medications=body.current_medications,
        past_conditions=body.past_conditions,
        triage_notes=body.triage_notes,
        recorded_by=user_id,
    )
    db.add(triage)
    db.commit()
    db.refresh(triage)
    log_audit(db, organization_id, user_id, action="create", resource_type="triage", resource_id=triage.id, data_classification="CLI")
    return _triage_to_response(triage)


# ---- Story 5.2: Evolucao clinica ----
ROLES_MED_WRITE = ["med", "gcl"]


def _evolution_to_response(ev: ClinicalEvolution) -> ClinicalEvolutionResponse:
    return ClinicalEvolutionResponse(
        id=ev.id,
        encounter_id=ev.encounter_id,
        evolution_type=ev.evolution_type,
        anamnesis=ev.anamnesis,
        clinical_history=ev.clinical_history,
        family_history=ev.family_history,
        physical_exam=ev.physical_exam,
        diagnostic_hypotheses=ev.diagnostic_hypotheses,
        therapeutic_plan=ev.therapeutic_plan,
        patient_guidance=ev.patient_guidance,
        suggested_return_date=ev.suggested_return_date,
        status=ev.status,
        recorded_by=ev.recorded_by,
        finalized_at=ev.finalized_at,
        created_at=ev.created_at,
        updated_at=ev.updated_at,
    )


@router.get("/encounters/{encounter_id}/evolutions", response_model=list[ClinicalEvolutionResponse])
def list_evolutions(
    encounter_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Lista evolucoes clinicas do atendimento."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    evolutions = (
        db.execute(
            select(ClinicalEvolution).where(ClinicalEvolution.encounter_id == encounter_id).order_by(ClinicalEvolution.created_at.desc())
        )
        .scalars().all()
    )
    return [_evolution_to_response(ev) for ev in evolutions]


@router.get("/encounters/{encounter_id}/evolutions/{evolution_id}", response_model=ClinicalEvolutionResponse)
def get_evolution(
    encounter_id: str,
    evolution_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Detalhe de uma evolucao clinica."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    ev = db.execute(
        select(ClinicalEvolution).where(
            ClinicalEvolution.id == evolution_id,
            ClinicalEvolution.encounter_id == encounter_id,
        )
    ).scalars().one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evolucao nao encontrada.")
    return _evolution_to_response(ev)


@router.post("/encounters/{encounter_id}/evolutions", response_model=ClinicalEvolutionResponse, status_code=201)
def create_evolution(
    encounter_id: str,
    body: ClinicalEvolutionCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_MED_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria evolucao clinica (rascunho). Apenas med/gcl."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    ev = ClinicalEvolution(
        encounter_id=encounter_id,
        evolution_type=body.evolution_type,
        anamnesis=body.anamnesis,
        clinical_history=body.clinical_history,
        family_history=body.family_history,
        physical_exam=body.physical_exam,
        diagnostic_hypotheses=body.diagnostic_hypotheses,
        therapeutic_plan=body.therapeutic_plan,
        patient_guidance=body.patient_guidance,
        suggested_return_date=body.suggested_return_date,
        status="draft",
        recorded_by=user_id,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    log_audit(
        db, organization_id, user_id,
        action="create", resource_type="clinical_evolution", resource_id=ev.id,
        data_classification="CLI", data_after={"status": "draft"},
    )
    return _evolution_to_response(ev)


@router.patch("/encounters/{encounter_id}/evolutions/{evolution_id}", response_model=ClinicalEvolutionResponse)
def update_evolution(
    encounter_id: str,
    evolution_id: str,
    body: ClinicalEvolutionUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_MED_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza evolucao apenas se status for draft."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    ev = db.execute(
        select(ClinicalEvolution).where(
            ClinicalEvolution.id == evolution_id,
            ClinicalEvolution.encounter_id == encounter_id,
        )
    ).scalars().one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evolucao nao encontrada.")
    if ev.status != "draft":
        raise HTTPException(status_code=400, detail="So e possivel editar evolucao em rascunho.")
    if body.evolution_type is not None:
        ev.evolution_type = body.evolution_type
    if body.anamnesis is not None:
        ev.anamnesis = body.anamnesis
    if body.clinical_history is not None:
        ev.clinical_history = body.clinical_history
    if body.family_history is not None:
        ev.family_history = body.family_history
    if body.physical_exam is not None:
        ev.physical_exam = body.physical_exam
    if body.diagnostic_hypotheses is not None:
        ev.diagnostic_hypotheses = body.diagnostic_hypotheses
    if body.therapeutic_plan is not None:
        ev.therapeutic_plan = body.therapeutic_plan
    if body.patient_guidance is not None:
        ev.patient_guidance = body.patient_guidance
    if body.suggested_return_date is not None:
        ev.suggested_return_date = body.suggested_return_date
    ev.recorded_by = user_id
    db.commit()
    db.refresh(ev)
    log_audit(db, organization_id, user_id, action="update", resource_type="clinical_evolution", resource_id=evolution_id, data_classification="CLI")
    return _evolution_to_response(ev)


@router.post("/encounters/{encounter_id}/evolutions/{evolution_id}/finalize", response_model=ClinicalEvolutionResponse)
def finalize_evolution(
    encounter_id: str,
    evolution_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_MED_WRITE)),
    db: Session = Depends(get_db),
):
    """Finaliza evolucao (status draft -> finalized)."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    ev = db.execute(
        select(ClinicalEvolution).where(
            ClinicalEvolution.id == evolution_id,
            ClinicalEvolution.encounter_id == encounter_id,
        )
    ).scalars().one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evolucao nao encontrada.")
    if ev.status != "draft":
        raise HTTPException(status_code=400, detail="Evolucao ja finalizada ou assinada.")
    ev.status = "finalized"
    ev.finalized_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ev)
    log_audit(
        db, organization_id, user_id,
        action="update", resource_type="clinical_evolution", resource_id=evolution_id,
        data_classification="CLI", data_before={"status": "draft"}, data_after={"status": "finalized"},
    )
    return _evolution_to_response(ev)


# ---- Story 5.3: Prescricao ----

def _prescription_to_response(p: Prescription) -> PrescriptionResponse:
    return PrescriptionResponse(
        id=p.id,
        encounter_id=p.encounter_id,
        status=p.status,
        recorded_by=p.recorded_by,
        finalized_at=p.finalized_at,
        created_at=p.created_at,
        updated_at=p.updated_at,
        items=[PrescriptionItemResponse.model_validate(i) for i in p.items],
    )

@router.get("/encounters/{encounter_id}/prescriptions/{prescription_id}/pdf", response_class=Response)
def get_prescription_pdf(
    encounter_id: str,
    prescription_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Gera e retorna o PDF da prescricao."""
    from src.services.pdf_service import generate_prescription_pdf
    from src.db.models import Organization

    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    p = db.execute(
        select(Prescription)
        .where(
            Prescription.id == prescription_id,
            Prescription.encounter_id == encounter_id,
        )
        .options(selectinload(Prescription.items))
    ).scalars().one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Prescricao nao encontrada.")

    # Busca dependencias
    org = db.execute(select(Organization).where(Organization.id == organization_id)).scalars().one()
    patient = db.execute(select(Patient).where(Patient.id == encounter.patient_id)).scalars().one()
    professional = db.execute(select(HealthProfessional).where(HealthProfessional.id == encounter.professional_id)).scalars().one()
    
    unit = None
    if encounter.unit_id:
        from src.db.models_crm import Unit
        unit = db.execute(select(Unit).where(Unit.id == encounter.unit_id)).scalars().one_or_none()

    pdf_bytes = generate_prescription_pdf(p, patient, professional, unit, org)
    
    headers = {
        "Content-Disposition": f"attachment; filename=Receituario - {patient.full_name}.pdf"
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)



def _exam_request_to_response(er: ExamRequest) -> ExamRequestResponse:
    return ExamRequestResponse(
        id=er.id,
        encounter_id=er.encounter_id,
        status=er.status,
        recorded_by=er.recorded_by,
        finalized_at=er.finalized_at,
        created_at=er.created_at,
        updated_at=er.updated_at,
        items=[ExamRequestItemResponse.model_validate(i) for i in er.items],
    )


@router.get("/encounters/{encounter_id}/prescriptions", response_model=list[PrescriptionResponse])
def list_prescriptions(
    encounter_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Lista prescricoes do atendimento."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    rows = (
        db.execute(
            select(Prescription)
            .where(Prescription.encounter_id == encounter_id)
            .options(selectinload(Prescription.items))
            .order_by(Prescription.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [_prescription_to_response(p) for p in rows]


@router.get("/encounters/{encounter_id}/prescriptions/{prescription_id}", response_model=PrescriptionResponse)
def get_prescription(
    encounter_id: str,
    prescription_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Detalhe de uma prescricao."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    p = db.execute(
        select(Prescription)
        .where(
            Prescription.id == prescription_id,
            Prescription.encounter_id == encounter_id,
        )
        .options(selectinload(Prescription.items))
    ).scalars().one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Prescricao nao encontrada.")
    return _prescription_to_response(p)


@router.post("/encounters/{encounter_id}/prescriptions", response_model=PrescriptionResponse, status_code=201)
def create_prescription(
    encounter_id: str,
    body: PrescriptionCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_MED_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria prescricao (rascunho) com itens. Apenas med/gcl."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    prescription = Prescription(
        encounter_id=encounter_id,
        status="draft",
        recorded_by=user_id,
    )
    db.add(prescription)
    db.flush()
    for pos, item in enumerate(body.items):
        db.add(
            PrescriptionItem(
                prescription_id=prescription.id,
                medication=item.medication,
                dosage=item.dosage,
                posology=item.posology,
                instructions=item.instructions,
                position=pos,
            )
        )
    db.commit()
    prescription = db.execute(
        select(Prescription)
        .where(Prescription.id == prescription.id)
        .options(selectinload(Prescription.items))
    ).scalars().one()
    log_audit(
        db, organization_id, user_id,
        action="create", resource_type="prescription", resource_id=prescription.id,
        data_classification="CLI", data_after={"status": "draft"},
    )
    return _prescription_to_response(prescription)


@router.patch("/encounters/{encounter_id}/prescriptions/{prescription_id}", response_model=PrescriptionResponse)
def update_prescription(
    encounter_id: str,
    prescription_id: str,
    body: PrescriptionUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_MED_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza prescricao (apenas draft): substitui itens."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    p = db.execute(
        select(Prescription)
        .where(
            Prescription.id == prescription_id,
            Prescription.encounter_id == encounter_id,
        )
        .options(selectinload(Prescription.items))
    ).scalars().one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Prescricao nao encontrada.")
    if p.status != "draft":
        raise HTTPException(status_code=400, detail="So e possivel editar prescricao em rascunho.")
    for item in p.items:
        db.delete(item)
    db.flush()
    for pos, item in enumerate(body.items):
        db.add(
            PrescriptionItem(
                prescription_id=p.id,
                medication=item.medication,
                dosage=item.dosage,
                posology=item.posology,
                instructions=item.instructions,
                position=pos,
            )
        )
    p.recorded_by = user_id
    db.commit()
    db.refresh(p)
    p = db.execute(
        select(Prescription)
        .where(Prescription.id == prescription_id)
        .options(selectinload(Prescription.items))
    ).scalars().one()
    log_audit(db, organization_id, user_id, action="update", resource_type="prescription", resource_id=prescription_id, data_classification="CLI")
    return _prescription_to_response(p)


@router.post("/encounters/{encounter_id}/prescriptions/{prescription_id}/finalize", response_model=PrescriptionResponse)
def finalize_prescription(
    encounter_id: str,
    prescription_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_MED_WRITE)),
    db: Session = Depends(get_db),
):
    """Finaliza prescricao (draft -> finalized)."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    p = db.execute(
        select(Prescription)
        .where(
            Prescription.id == prescription_id,
            Prescription.encounter_id == encounter_id,
        )
        .options(selectinload(Prescription.items))
    ).scalars().one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Prescricao nao encontrada.")
    if p.status != "draft":
        raise HTTPException(status_code=400, detail="Prescricao ja finalizada.")
    if not p.items:
        raise HTTPException(status_code=400, detail="Adicione ao menos um medicamento antes de finalizar.")
    p.status = "finalized"
    p.finalized_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(p)
    p = db.execute(
        select(Prescription)
        .where(Prescription.id == prescription_id)
        .options(selectinload(Prescription.items))
    ).scalars().one()
    log_audit(
        db, organization_id, user_id,
        action="update", resource_type="prescription", resource_id=prescription_id,
        data_classification="CLI", data_before={"status": "draft"}, data_after={"status": "finalized"},
    )
    return _prescription_to_response(p)


# ---- Story 5.4: Solicitacao de exames ----

@router.get("/encounters/{encounter_id}/exam-requests", response_model=list[ExamRequestResponse])
def list_exam_requests(
    encounter_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Lista solicitacoes de exames do atendimento."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    rows = (
        db.execute(
            select(ExamRequest)
            .where(ExamRequest.encounter_id == encounter_id)
            .options(selectinload(ExamRequest.items))
            .order_by(ExamRequest.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [_exam_request_to_response(er) for er in rows]


@router.get("/encounters/{encounter_id}/exam-requests/{exam_request_id}", response_model=ExamRequestResponse)
def get_exam_request(
    encounter_id: str,
    exam_request_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Detalhe de uma solicitacao de exames."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    er = db.execute(
        select(ExamRequest)
        .where(
            ExamRequest.id == exam_request_id,
            ExamRequest.encounter_id == encounter_id,
        )
        .options(selectinload(ExamRequest.items))
    ).scalars().one_or_none()
    if not er:
        raise HTTPException(status_code=404, detail="Solicitacao de exames nao encontrada.")
    return _exam_request_to_response(er)


@router.post("/encounters/{encounter_id}/exam-requests", response_model=ExamRequestResponse, status_code=201)
def create_exam_request(
    encounter_id: str,
    body: ExamRequestCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_MED_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria solicitacao de exames (rascunho) com itens. Apenas med/gcl."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    exam_request = ExamRequest(
        encounter_id=encounter_id,
        status="draft",
        recorded_by=user_id,
    )
    db.add(exam_request)
    db.flush()
    for pos, item in enumerate(body.items):
        db.add(
            ExamRequestItem(
                exam_request_id=exam_request.id,
                exam_name=item.exam_name,
                instructions=item.instructions,
                position=pos,
            )
        )
    db.commit()
    exam_request = db.execute(
        select(ExamRequest)
        .where(ExamRequest.id == exam_request.id)
        .options(selectinload(ExamRequest.items))
    ).scalars().one()
    log_audit(
        db, organization_id, user_id,
        action="create", resource_type="exam_request", resource_id=exam_request.id,
        data_classification="CLI", data_after={"status": "draft"},
    )
    return _exam_request_to_response(exam_request)


@router.patch("/encounters/{encounter_id}/exam-requests/{exam_request_id}", response_model=ExamRequestResponse)
def update_exam_request(
    encounter_id: str,
    exam_request_id: str,
    body: ExamRequestUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_MED_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza solicitacao de exames (apenas draft): substitui itens."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    er = db.execute(
        select(ExamRequest)
        .where(
            ExamRequest.id == exam_request_id,
            ExamRequest.encounter_id == encounter_id,
        )
        .options(selectinload(ExamRequest.items))
    ).scalars().one_or_none()
    if not er:
        raise HTTPException(status_code=404, detail="Solicitacao de exames nao encontrada.")
    if er.status != "draft":
        raise HTTPException(status_code=400, detail="So e possivel editar solicitacao em rascunho.")
    for item in er.items:
        db.delete(item)
    db.flush()
    for pos, item in enumerate(body.items):
        db.add(
            ExamRequestItem(
                exam_request_id=er.id,
                exam_name=item.exam_name,
                instructions=item.instructions,
                position=pos,
            )
        )
    er.recorded_by = user_id
    db.commit()
    db.refresh(er)
    er = db.execute(
        select(ExamRequest)
        .where(ExamRequest.id == exam_request_id)
        .options(selectinload(ExamRequest.items))
    ).scalars().one()
    log_audit(db, organization_id, user_id, action="update", resource_type="exam_request", resource_id=exam_request_id, data_classification="CLI")
    return _exam_request_to_response(er)


@router.post("/encounters/{encounter_id}/exam-requests/{exam_request_id}/finalize", response_model=ExamRequestResponse)
def finalize_exam_request(
    encounter_id: str,
    exam_request_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_MED_WRITE)),
    db: Session = Depends(get_db),
):
    """Finaliza solicitacao de exames (draft -> finalized)."""
    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")
    er = db.execute(
        select(ExamRequest)
        .where(
            ExamRequest.id == exam_request_id,
            ExamRequest.encounter_id == encounter_id,
        )
        .options(selectinload(ExamRequest.items))
    ).scalars().one_or_none()
    if not er:
        raise HTTPException(status_code=404, detail="Solicitacao de exames nao encontrada.")
    if er.status != "draft":
        raise HTTPException(status_code=400, detail="Solicitacao ja finalizada.")
    if not er.items:
        raise HTTPException(status_code=400, detail="Adicione ao menos um exame antes de finalizar.")
    er.status = "finalized"
    er.finalized_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(er)
    er = db.execute(
        select(ExamRequest)
        .where(ExamRequest.id == exam_request_id)
        .options(selectinload(ExamRequest.items))
    ).scalars().one()
    log_audit(
        db, organization_id, user_id,
        action="update", resource_type="exam_request", resource_id=exam_request_id,
        data_classification="CLI", data_before={"status": "draft"}, data_after={"status": "finalized"},
    )
    return _exam_request_to_response(er)


@router.get("/encounters/{encounter_id}/exam-requests/{exam_request_id}/pdf", response_class=Response)
def get_exam_request_pdf(
    encounter_id: str,
    exam_request_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_CLI)),
    db: Session = Depends(get_db),
):
    """Gera o PDF da solicitacao de exames."""
    from src.services.pdf_service import generate_exam_request_pdf
    from src.db.models import Organization

    encounter = db.execute(
        select(ClinicalEncounter).where(
            ClinicalEncounter.id == encounter_id,
            ClinicalEncounter.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Atendimento nao encontrado.")

    er = db.execute(
        select(ExamRequest)
        .where(
            ExamRequest.id == exam_request_id,
            ExamRequest.encounter_id == encounter_id,
        )
        .options(selectinload(ExamRequest.items))
    ).scalars().one_or_none()
    if not er:
        raise HTTPException(status_code=404, detail="Solicitacao de exames nao encontrada.")

    org = db.execute(select(Organization).where(Organization.id == organization_id)).scalars().one()
    patient = db.execute(select(Patient).where(Patient.id == encounter.patient_id)).scalars().one()
    professional = db.execute(select(HealthProfessional).where(HealthProfessional.id == encounter.professional_id)).scalars().one()

    pdf_bytes = generate_exam_request_pdf(er, patient, professional, org)
    
    headers = {
        "Content-Disposition": f"attachment; filename=Solicitacao de Exames - {patient.full_name}.pdf"
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)

