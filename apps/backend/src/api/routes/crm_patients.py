"""Rotas CRM: Pacientes. Requer JWT + X-Organization-Id + RBAC."""
import logging
import os
from datetime import date, datetime as dt, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from src.api.deps import require_organization_id, require_org_role
from src.api.middleware.auth import require_user_id
from src.db.models_crm import Patient, PatientConsent, PatientDocument, PatientGuardian, PatientInsurance
from src.db.session import get_db
from src.schemas.crm import (
    ConsentGrant,
    ConsentRevoke,
    GuardianCreate,
    GuardianUpdate,
    InsuranceCreate,
    InsuranceUpdate,
    PatientCreate,
    PatientConsentResponse,
    PatientDocumentResponse,
    PatientGuardianResponse,
    PatientInsuranceResponse,
    PatientListItemResponse,
    PatientListResponse,
    PatientResponse,
    PatientUpdate,
)
from src.services.audit_service import log_audit
from src.services.document_storage import save_document

logger = logging.getLogger("completepay.crm")

router = APIRouter(prefix="/patients", tags=["crm-patients"])

# Leitura: RCP, FIN, ENF, MED, GCL, MKT (RBAC matrix - dados ADM paciente)
# Escrita: RCP, GCL
ROLES_READ = ["rcp", "fin", "enf", "med", "gcl", "mkt"]
ROLES_WRITE = ["rcp", "gcl"]


def _normalize_cpf(cpf: str | None) -> str | None:
    """Remove caracteres nao numericos do CPF."""
    if not cpf or not cpf.strip():
        return None
    digits = "".join(c for c in cpf.strip() if c.isdigit())
    return digits if len(digits) >= 10 else None


def _normalize_phone(phone: str | None) -> str:
    """Remove caracteres nao numericos do telefone."""
    if not phone:
        return ""
    return "".join(c for c in phone.strip() if c.isdigit())


@router.get("", response_model=PatientListResponse)
def list_patients(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=500),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, description="Busca por nome, CPF, telefone ou data (YYYY-MM-DD)"),
):
    """Lista pacientes com paginacao. q busca em nome, CPF, telefone ou data de nascimento."""
    base = select(Patient).where(Patient.organization_id == organization_id)
    if q and q.strip():
        term = q.strip()
        term_like = f"%{term}%"
        # Nome (parcial)
        name_cond = or_(
            Patient.full_name.ilike(term_like),
            (Patient.social_name.isnot(None)) & (Patient.social_name.ilike(term_like)),
        )
        # CPF (exato, apenas digitos)
        cpf_digits = "".join(c for c in term if c.isdigit())
        cpf_cond = Patient.cpf == cpf_digits if len(cpf_digits) >= 10 else False
        # Telefone (parcial, digitos)
        phone_cond = (
            func.replace(func.replace(func.replace(Patient.phone, " ", ""), "-", ""), "(", "").like(f"%{cpf_digits}%")
            if cpf_digits
            else False
        )
        # Data nascimento (YYYY-MM-DD ou DD/MM/YYYY)
        birth_cond = False
        if len(term) >= 8:
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                try:
                    parsed = dt.strptime(term, fmt).date()
                    birth_cond = birth_cond | (Patient.birth_date == parsed)
                    break
                except ValueError:
                    continue
        base = base.where(or_(name_cond, cpf_cond, phone_cond, birth_cond))
    count_q = select(func.count()).select_from(base.subquery())
    total = db.execute(count_q).scalar() or 0
    rows = (
        db.execute(base.order_by(Patient.full_name).limit(limit).offset(offset))
        .scalars()
        .all()
    )
    patients = rows  # .scalars().all() já retorna list[Patient]
    return PatientListResponse(
        items=[PatientListItemResponse.model_validate(p) for p in patients],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/check-duplicate", response_model=list[PatientListItemResponse])
def check_duplicate_patients(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
    full_name: str | None = Query(None),
    birth_date: date | None = Query(None),
    phone: str | None = Query(None),
    cpf: str | None = Query(None),
):
    """Retorna possiveis duplicatas por CPF, telefone ou nome+data de nascimento. Story 2.4."""
    from sqlalchemy import and_

    base = select(Patient).where(Patient.organization_id == organization_id)
    conditions = []
    if cpf and _normalize_cpf(cpf):
        conditions.append(Patient.cpf == _normalize_cpf(cpf))
    if phone and _normalize_phone(phone):
        digits = _normalize_phone(phone)
        if len(digits) >= 8:
            conditions.append(
                func.replace(
                    func.replace(func.replace(Patient.phone, " ", ""), "-", ""), "(", ""
                ).like(f"%{digits}%")
            )
    if full_name and full_name.strip() and birth_date:
        conditions.append(
            and_(
                Patient.full_name.ilike(f"%{full_name.strip()}%"),
                Patient.birth_date == birth_date,
            )
        )
    if not conditions:
        return []
    base = base.where(or_(*conditions))
    rows = db.execute(base.order_by(Patient.full_name).limit(20)).scalars().all()
    return [PatientListItemResponse.model_validate(r) for r in rows]


@router.post("", response_model=PatientResponse, status_code=201)
def create_patient(
    body: PatientCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria paciente. Auditoria registrada."""
    if body.cpf:
        existing = (
            db.execute(
                select(Patient).where(
                    Patient.organization_id == organization_id,
                    Patient.cpf == body.cpf,
                )
            )
            .scalars().first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Ja existe paciente com este CPF nesta organizacao.")
    patient = Patient(
        organization_id=organization_id,
        full_name=body.full_name,
        social_name=body.social_name,
        birth_date=body.birth_date,
        phone=body.phone,
        cpf=body.cpf,
        email=body.email,
        sex=body.sex,
        origin=body.origin,
        status="ativo",
        created_by=user_id,
        cep=body.cep,
        logradouro=body.logradouro,
        numero=body.numero,
        complemento=body.complemento,
        bairro=body.bairro,
        cidade=body.cidade,
        uf=body.uf,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    log_audit(
        db,
        organization_id=organization_id,
        user_id=user_id,
        action="create",
        resource_type="patient",
        resource_id=patient.id,
        data_classification="ADM",
        data_after=PatientResponse.model_validate(patient).model_dump(mode="json"),
    )
    return PatientResponse.model_validate(patient)


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna paciente por ID."""
    row = (
        db.execute(
            select(Patient)
            .where(
                Patient.id == patient_id,
                Patient.organization_id == organization_id,
            )
            .options(
                selectinload(Patient.guardians),
                selectinload(Patient.insurances),
            )
        )
        .scalars().first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")
    return PatientResponse.model_validate(row)


@router.patch("/{patient_id}", response_model=PatientResponse)
def update_patient(
  patient_id: str,
  body: PatientUpdate,
  user_id: str = Depends(require_user_id),
  organization_id: str = Depends(require_organization_id),
  _role: str = Depends(require_org_role(ROLES_WRITE)),
  db: Session = Depends(get_db),
):
    """Atualiza paciente (parcial)."""
    row = (
        db.execute(
            select(Patient).where(
                Patient.id == patient_id,
                Patient.organization_id == organization_id,
            )
        )
        .scalars().first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")
    patient = row
    before = PatientResponse.model_validate(patient).model_dump(mode="json")
    payload = body.model_dump(exclude_unset=True)
    if body.cpf is not None and body.cpf != patient.cpf:
        other = (
            db.execute(
                select(Patient).where(
                    Patient.organization_id == organization_id,
                    Patient.cpf == body.cpf,
                    Patient.id != patient_id,
                )
            )
            .scalars().first()
        )
        if other:
            raise HTTPException(status_code=400, detail="Ja existe outro paciente com este CPF.")
    for k, v in payload.items():
        setattr(patient, k, v)
    db.commit()
    db.refresh(patient)
    log_audit(
        db,
        organization_id=organization_id,
        user_id=user_id,
        action="update",
        resource_type="patient",
        resource_id=patient.id,
        data_classification="ADM",
        data_before=before,
        data_after=PatientResponse.model_validate(patient).model_dump(mode="json"),
    )
    return PatientResponse.model_validate(patient)


def _get_patient_or_404(db: Session, patient_id: str, organization_id: str) -> Patient:
    row = (
        db.execute(
            select(Patient).where(
                Patient.id == patient_id,
                Patient.organization_id == organization_id,
            )
        )
        .scalars().first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")
    return row


# ---- Responsáveis (guardians) ----
@router.post("/{patient_id}/guardians", response_model=PatientGuardianResponse, status_code=201)
def create_guardian(
    patient_id: str,
    body: GuardianCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Adiciona responsável legal ao paciente."""
    patient = _get_patient_or_404(db, patient_id, organization_id)
    guardian = PatientGuardian(
        patient_id=patient.id,
        name=body.name,
        cpf=body.cpf,
        parentesco=body.parentesco,
        phone=body.phone,
        email=body.email,
        autorizado_informacoes=body.autorizado_informacoes,
    )
    db.add(guardian)
    db.commit()
    db.refresh(guardian)
    return PatientGuardianResponse.model_validate(guardian)


@router.patch("/{patient_id}/guardians/{guardian_id}", response_model=PatientGuardianResponse)
def update_guardian(
    patient_id: str,
    guardian_id: str,
    body: GuardianUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza responsável legal."""
    _get_patient_or_404(db, patient_id, organization_id)
    row = db.execute(
        select(PatientGuardian).where(
            PatientGuardian.id == guardian_id,
            PatientGuardian.patient_id == patient_id,
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Responsavel nao encontrado.")
    guardian = row
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(guardian, k, v)
    db.commit()
    db.refresh(guardian)
    return PatientGuardianResponse.model_validate(guardian)


@router.delete("/{patient_id}/guardians/{guardian_id}", status_code=204)
def delete_guardian(
    patient_id: str,
    guardian_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Remove responsável legal."""
    _get_patient_or_404(db, patient_id, organization_id)
    row = db.execute(
        select(PatientGuardian).where(
            PatientGuardian.id == guardian_id,
            PatientGuardian.patient_id == patient_id,
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Responsavel nao encontrado.")
    db.delete(row)
    db.commit()
    return None


# ---- Convênios do paciente (insurances) ----
@router.post("/{patient_id}/insurances", response_model=PatientInsuranceResponse, status_code=201)
def create_insurance(
    patient_id: str,
    body: InsuranceCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Adiciona vínculo convênio/particular ao paciente."""
    patient = _get_patient_or_404(db, patient_id, organization_id)
    insurance = PatientInsurance(
        patient_id=patient.id,
        tipo_atendimento=body.tipo_atendimento,
        convenio_id=body.convenio_id,
        plano=body.plano,
        numero_carteirinha=body.numero_carteirinha,
        validade=body.validade,
        titular=body.titular,
        ativo=body.ativo,
    )
    db.add(insurance)
    db.commit()
    db.refresh(insurance)
    return PatientInsuranceResponse.model_validate(insurance)


@router.patch("/{patient_id}/insurances/{insurance_id}", response_model=PatientInsuranceResponse)
def update_insurance(
    patient_id: str,
    insurance_id: str,
    body: InsuranceUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza vínculo convênio/particular."""
    _get_patient_or_404(db, patient_id, organization_id)
    row = db.execute(
        select(PatientInsurance).where(
            PatientInsurance.id == insurance_id,
            PatientInsurance.patient_id == patient_id,
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Convênio do paciente nao encontrado.")
    insurance = row
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(insurance, k, v)
    db.commit()
    db.refresh(insurance)
    return PatientInsuranceResponse.model_validate(insurance)


@router.delete("/{patient_id}/insurances/{insurance_id}", status_code=204)
def delete_insurance(
    patient_id: str,
    insurance_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Remove vínculo convênio/particular."""
    _get_patient_or_404(db, patient_id, organization_id)
    row = db.execute(
        select(PatientInsurance).where(
            PatientInsurance.id == insurance_id,
            PatientInsurance.patient_id == patient_id,
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Convênio do paciente nao encontrado.")
    db.delete(row)
    db.commit()
    return None


# ---- Consentimentos LGPD (Story 2.3) ----
@router.get("/{patient_id}/consents", response_model=list[PatientConsentResponse])
def list_consents(
    patient_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Lista consentimentos do paciente (histórico por tipo)."""
    _get_patient_or_404(db, patient_id, organization_id)
    rows = (
        db.execute(
            select(PatientConsent).where(PatientConsent.patient_id == patient_id).order_by(PatientConsent.granted_at.desc())
        )
        .scalars().all()
    )
    return [PatientConsentResponse.model_validate(r) for r in rows]


@router.post("/{patient_id}/consents", response_model=PatientConsentResponse, status_code=201)
def grant_consent(
    patient_id: str,
    body: ConsentGrant,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Registra ou atualiza consentimento (concedido). Se já existir ativo, atualiza granted_at/channel/term_version."""
    _get_patient_or_404(db, patient_id, organization_id)
    existing = (
        db.execute(
            select(PatientConsent).where(
                PatientConsent.patient_id == patient_id,
                PatientConsent.consent_type == body.consent_type,
                PatientConsent.revoked_at.is_(None),
            )
        )
        .scalars().first()
    )
    if existing:
        c = existing
        c.granted = body.granted
        c.channel = body.channel
        c.term_version = body.term_version
        c.granted_by = user_id
        db.commit()
        db.refresh(c)
        return PatientConsentResponse.model_validate(c)
    consent = PatientConsent(
        patient_id=patient_id,
        consent_type=body.consent_type,
        granted=body.granted,
        granted_by=user_id,
        channel=body.channel,
        term_version=body.term_version,
    )
    db.add(consent)
    db.commit()
    db.refresh(consent)
    return PatientConsentResponse.model_validate(consent)


@router.post("/{patient_id}/consents/{consent_id}/revoke", response_model=PatientConsentResponse)
def revoke_consent(
    patient_id: str,
    consent_id: str,
    body: ConsentRevoke,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Revoga consentimento."""
    _get_patient_or_404(db, patient_id, organization_id)
    row = db.execute(
        select(PatientConsent).where(
            PatientConsent.id == consent_id,
            PatientConsent.patient_id == patient_id,
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Consentimento nao encontrado.")
    c = row
    if c.revoked_at:
        raise HTTPException(status_code=400, detail="Consentimento ja revogado.")
    c.revoked_at = dt.now(timezone.utc)
    c.revoked_by = user_id
    c.revocation_reason = body.revocation_reason
    db.commit()
    db.refresh(c)
    return PatientConsentResponse.model_validate(c)


def _can_access_document(role: str, data_classification: str) -> bool:
    """RBAC: quem pode ver cada classificacao. Story 2.5."""
    r = (role or "").strip().lower()
    if r == "owner":
        r = "gcl"
    c = (data_classification or "ADM").strip().upper()
    if c == "ADM" or c == "DOC":
        return r in ("rcp", "fin", "enf", "med", "gcl", "mkt")
    if c == "CLI":
        return r in ("enf", "med", "gcl")
    if c == "FIN":
        return r in ("rcp", "fin", "gcl")
    return False


ALLOWED_DOCUMENT_CATEGORIES = ("identificacao", "carteirinha", "exame", "laudo", "termo", "comprovante")
ALLOWED_MIME = ("application/pdf", "image/jpeg", "image/png", "image/jpg")
MAX_DOCUMENT_SIZE = 10 * 1024 * 1024  # 10MB


# ---- Documentos do paciente (Story 2.5) ----
@router.get("/{patient_id}/documents", response_model=list[PatientDocumentResponse])
def list_documents(
    patient_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Lista documentos do paciente. Filtra por RBAC (classificacao)."""
    _get_patient_or_404(db, patient_id, organization_id)
    rows = (
        db.execute(
            select(PatientDocument).where(
                PatientDocument.patient_id == patient_id,
                PatientDocument.organization_id == organization_id,
            ).order_by(PatientDocument.created_at.desc())
        )
        .scalars().all()
    )
    out = []
    for doc in rows:
        if _can_access_document(role, doc.data_classification):
            out.append(PatientDocumentResponse.model_validate(doc))
    return out


@router.post("/{patient_id}/documents", response_model=PatientDocumentResponse, status_code=201)
async def upload_document(
    patient_id: str,
    category: str = Query(..., description="identificacao|carteirinha|exame|laudo|termo|comprovante"),
    data_classification: str = Query("ADM", description="ADM|CLI|FIN|DOC"),
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
):
    """Upload de documento. PDF, JPG ou PNG ate 10MB."""
    if category not in ALLOWED_DOCUMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoria invalida.")
    if data_classification not in ("ADM", "CLI", "FIN", "DOC"):
        raise HTTPException(status_code=400, detail="Classificacao invalida.")
    patient = _get_patient_or_404(db, patient_id, organization_id)
    contents = await file.read()
    if len(contents) > MAX_DOCUMENT_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo maior que 10MB.")
    mime = (file.content_type or "").strip().lower()
    if mime not in ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail="Formato nao permitido. Use PDF, JPG ou PNG.",
        )
    doc_id = str(__import__("uuid").uuid4())
    file_path = save_document(
        organization_id=organization_id,
        patient_id=patient_id,
        document_id=doc_id,
        filename=file.filename or "document",
        content=contents,
        content_type=mime,
    )
    doc = PatientDocument(
        id=doc_id,
        patient_id=patient_id,
        organization_id=organization_id,
        category=category,
        file_path=file_path,
        file_name=file.filename or "document",
        file_size=len(contents),
        mime_type=mime,
        uploaded_by=user_id,
        data_classification=data_classification,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    log_audit(
        db,
        organization_id=organization_id,
        user_id=user_id,
        action="create",
        resource_type="patient_document",
        resource_id=doc.id,
        data_classification=data_classification,
        data_after={"patient_id": patient_id, "category": category, "file_name": doc.file_name},
    )
    return PatientDocumentResponse.model_validate(doc)


@router.get("/{patient_id}/documents/{document_id}/file")
def get_document_file(
    patient_id: str,
    document_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna o arquivo do documento (stream). RBAC aplicado."""
    _get_patient_or_404(db, patient_id, organization_id)
    row = db.execute(
        select(PatientDocument).where(
            PatientDocument.id == document_id,
            PatientDocument.patient_id == patient_id,
            PatientDocument.organization_id == organization_id,
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Documento nao encontrado.")
    doc = row
    if not _can_access_document(role, doc.data_classification):
        raise HTTPException(status_code=403, detail="Sem permissao para este documento.")
    file_path = doc.file_path or ""
    base = Path(__file__).resolve().parent.parent.parent.parent
    full_path = base / file_path.lstrip("/").replace("/", os.sep)
    if not full_path or not full_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado no servidor.")
    return FileResponse(str(full_path), media_type=doc.mime_type, filename=doc.file_name)


@router.delete("/{patient_id}/documents/{document_id}", status_code=204)
def delete_document(
    patient_id: str,
    document_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Remove documento do paciente."""
    _get_patient_or_404(db, patient_id, organization_id)
    row = db.execute(
        select(PatientDocument).where(
            PatientDocument.id == document_id,
            PatientDocument.patient_id == patient_id,
            PatientDocument.organization_id == organization_id,
        )
    ).scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail="Documento nao encontrado.")
    db.delete(row)
    db.commit()
    return None
