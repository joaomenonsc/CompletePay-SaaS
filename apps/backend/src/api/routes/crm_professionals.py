"""Rotas CRM: Profissionais de Saude. Story 3.1 / 3.4. Requer JWT + X-Organization-Id + RBAC.
Agenda do profissional: conforme PRD 10.3, usa API do Calendario (AvailabilitySchedule) e use-schedules.ts no frontend."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from src.api.deps import require_organization_id, require_org_role
from src.api.middleware.auth import require_user_id
from src.db.models_crm import (
    HealthProfessional,
    HealthProfessionalUnit,
    ProfessionalDocument,
    ProfessionalFinancial,
    ProfessionalTermAcceptance,
    Unit,
)
from src.db.session import get_db
from src.schemas.crm import (
    ProfessionalCreate,
    ProfessionalDocumentCreate,
    ProfessionalDocumentResponse,
    ProfessionalFinancialResponse,
    ProfessionalFinancialUpdate,
    ProfessionalListItemResponse,
    ProfessionalListResponse,
    ProfessionalResponse,
    ProfessionalTermAcceptRequest,
    ProfessionalTermAcceptanceResponse,
    ProfessionalUpdate,
)
from src.services.audit_service import log_audit

logger = logging.getLogger("completepay.crm")

router = APIRouter(prefix="/professionals", tags=["crm-professionals"])

# RBAC: leitura todos os roles de saude; escrita apenas GCL (gestor)
ROLES_READ = ["rcp", "fin", "enf", "med", "gcl", "mkt"]
ROLES_WRITE = ["gcl"]
ROLES_READ_FIN = ["fin", "gcl"]
ROLES_WRITE_FIN = ["fin", "gcl"]


@router.get("", response_model=ProfessionalListResponse)
def list_professionals(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=500),
    offset: int = Query(0, ge=0),
    q: str | None = Query(None, description="Busca por nome ou numero de registro"),
):
    """Lista profissionais com paginacao."""
    base = select(HealthProfessional).where(HealthProfessional.organization_id == organization_id)
    if q and q.strip():
        term = q.strip()
        term_like = f"%{term}%"
        base = base.where(
            or_(
                HealthProfessional.full_name.ilike(term_like),
                (HealthProfessional.social_name.isnot(None)) & (HealthProfessional.social_name.ilike(term_like)),
                HealthProfessional.registration_number.ilike(term_like),
            )
        )
    count_q = select(func.count()).select_from(base.subquery())
    total = db.execute(count_q).scalar() or 0
    rows = (
        db.execute(base.order_by(HealthProfessional.full_name).limit(limit).offset(offset))
        .scalars()
        .all()
    )
    return ProfessionalListResponse(
        items=[ProfessionalListItemResponse.model_validate(p) for p in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


def _load_professional_with_units(db: Session, professional_id: str, organization_id: str):
    """Carrega profissional com professional_units para serializar unit_ids."""
    return (
        db.execute(
            select(HealthProfessional)
            .where(
                HealthProfessional.id == professional_id,
                HealthProfessional.organization_id == organization_id,
            )
            .options(selectinload(HealthProfessional.professional_units))
        )
        .scalars()
        .one_or_none()
    )


@router.get("/{professional_id}", response_model=ProfessionalResponse)
def get_professional(
    professional_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna profissional por ID."""
    row = _load_professional_with_units(db, professional_id, organization_id)
    if not row:
        raise HTTPException(status_code=404, detail="Profissional nao encontrado.")
    return ProfessionalResponse.model_validate(row)


def _validate_unit_ids(db: Session, unit_ids: list[str], organization_id: str) -> None:
    """Garante que todos os unit_ids pertencem à organizacao."""
    if not unit_ids:
        return
    rows = (
        db.execute(
            select(Unit).where(
                Unit.id.in_(unit_ids),
                Unit.organization_id == organization_id,
            )
        )
        .scalars()
        .all()
    )
    found = {u.id for u in rows}
    invalid = set(unit_ids) - found
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Unidades invalidas ou de outra organizacao: {sorted(invalid)}",
        )


@router.post("", response_model=ProfessionalResponse, status_code=201)
def create_professional(
    body: ProfessionalCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria profissional de saude."""
    unit_ids = body.unit_ids or []
    _validate_unit_ids(db, unit_ids, organization_id)
    professional = HealthProfessional(
        organization_id=organization_id,
        user_id=body.user_id,
        full_name=body.full_name,
        social_name=body.social_name,
        cpf=body.cpf,
        category=body.category,
        council=body.council,
        registration_number=body.registration_number.strip(),
        council_uf=body.council_uf.strip().upper(),
        rqe=body.rqe,
        phone=body.phone,
        email=body.email,
        city=body.city,
        uf=body.uf.strip().upper() if body.uf else None,
        status="ativo",
        employment_type=body.employment_type,
        modality=body.modality,
        default_slot_minutes=body.default_slot_minutes,
        accepts_encaixe=body.accepts_encaixe if body.accepts_encaixe is not None else False,
        buffer_between_minutes=body.buffer_between_minutes,
    )
    db.add(professional)
    db.flush()
    for uid in unit_ids:
        db.add(HealthProfessionalUnit(professional_id=professional.id, unit_id=uid))
    db.commit()
    db.refresh(professional)
    loaded = _load_professional_with_units(db, professional.id, organization_id)
    log_audit(
        db,
        organization_id=organization_id,
        user_id=user_id,
        action="create",
        resource_type="health_professional",
        resource_id=professional.id,
        data_classification="ADM",
        data_after=ProfessionalResponse.model_validate(loaded).model_dump(mode="json"),
    )
    return ProfessionalResponse.model_validate(loaded)


@router.patch("/{professional_id}", response_model=ProfessionalResponse)
def update_professional(
    professional_id: str,
    body: ProfessionalUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza profissional (parcial)."""
    row = (
        db.execute(
            select(HealthProfessional).where(
                HealthProfessional.id == professional_id,
                HealthProfessional.organization_id == organization_id,
            )
        )
        .scalars()
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Profissional nao encontrado.")
    professional = row
    loaded_before = _load_professional_with_units(db, professional_id, organization_id)
    before = ProfessionalResponse.model_validate(loaded_before).model_dump(mode="json")
    payload = body.model_dump(exclude_unset=True)
    unit_ids = payload.pop("unit_ids", None)
    if unit_ids is not None:
        _validate_unit_ids(db, unit_ids, organization_id)
        existing = (
            db.execute(
                select(HealthProfessionalUnit).where(
                    HealthProfessionalUnit.professional_id == professional_id
                )
            )
            .scalars()
            .all()
        )
        for pu in existing:
            db.delete(pu)
        for uid in unit_ids:
            db.add(HealthProfessionalUnit(professional_id=professional_id, unit_id=uid))
    if "council_uf" in payload and payload["council_uf"]:
        payload["council_uf"] = payload["council_uf"].strip().upper()
    if "uf" in payload and payload["uf"]:
        payload["uf"] = payload["uf"].strip().upper()
    for k, v in payload.items():
        setattr(professional, k, v)
    db.commit()
    db.refresh(professional)
    loaded = _load_professional_with_units(db, professional_id, organization_id)
    log_audit(
        db,
        organization_id=organization_id,
        user_id=user_id,
        action="update",
        resource_type="health_professional",
        resource_id=professional.id,
        data_classification="ADM",
        data_before=before,
        data_after=ProfessionalResponse.model_validate(loaded).model_dump(mode="json"),
    )
    return ProfessionalResponse.model_validate(loaded)


# ---- Documentos do profissional (Story 3.4) ----
@router.get("/{professional_id}/documents", response_model=list[ProfessionalDocumentResponse])
def list_professional_documents(
    professional_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Lista documentos do profissional."""
    if not _load_professional_with_units(db, professional_id, organization_id):
        raise HTTPException(status_code=404, detail="Profissional nao encontrado.")
    rows = (
        db.execute(
            select(ProfessionalDocument).where(
                ProfessionalDocument.professional_id == professional_id
            ).order_by(ProfessionalDocument.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [ProfessionalDocumentResponse.model_validate(r) for r in rows]


@router.post("/{professional_id}/documents", response_model=ProfessionalDocumentResponse, status_code=201)
def create_professional_document(
    professional_id: str,
    body: ProfessionalDocumentCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Registra documento do profissional."""
    if not _load_professional_with_units(db, professional_id, organization_id):
        raise HTTPException(status_code=404, detail="Profissional nao encontrado.")
    doc = ProfessionalDocument(
        professional_id=professional_id,
        category=body.category,
        file_path=body.file_path,
        file_name=body.file_name,
        file_size=body.file_size,
        mime_type=body.mime_type,
        valid_until=body.valid_until,
        uploaded_by=user_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return ProfessionalDocumentResponse.model_validate(doc)


@router.delete("/{professional_id}/documents/{document_id}", status_code=204)
def delete_professional_document(
    professional_id: str,
    document_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Remove documento do profissional."""
    if not _load_professional_with_units(db, professional_id, organization_id):
        raise HTTPException(status_code=404, detail="Profissional nao encontrado.")
    row = (
        db.execute(
            select(ProfessionalDocument).where(
                ProfessionalDocument.id == document_id,
                ProfessionalDocument.professional_id == professional_id,
            )
        )
        .scalars()
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Documento nao encontrado.")
    db.delete(row)
    db.commit()


# ---- Financeiro do profissional (Story 3.4, apenas fin+gcl) ----
@router.get("/{professional_id}/financial", response_model=ProfessionalFinancialResponse | None)
def get_professional_financial(
    professional_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ_FIN)),
    db: Session = Depends(get_db),
):
    """Retorna dados financeiros do profissional (somente fin+gcl)."""
    if not _load_professional_with_units(db, professional_id, organization_id):
        raise HTTPException(status_code=404, detail="Profissional nao encontrado.")
    row = (
        db.execute(
            select(ProfessionalFinancial).where(
                ProfessionalFinancial.professional_id == professional_id
            )
        )
        .scalars()
        .first()
    )
    return ProfessionalFinancialResponse.model_validate(row) if row else None


@router.patch("/{professional_id}/financial", response_model=ProfessionalFinancialResponse)
def update_professional_financial(
    professional_id: str,
    body: ProfessionalFinancialUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE_FIN)),
    db: Session = Depends(get_db),
):
    """Cria ou atualiza dados financeiros do profissional (fin+gcl)."""
    if not _load_professional_with_units(db, professional_id, organization_id):
        raise HTTPException(status_code=404, detail="Profissional nao encontrado.")
    row = (
        db.execute(
            select(ProfessionalFinancial).where(
                ProfessionalFinancial.professional_id == professional_id
            )
        )
        .scalars()
        .first()
    )
    if row:
        payload = body.model_dump(exclude_unset=True)
        for k, v in payload.items():
            setattr(row, k, v)
        db.commit()
        db.refresh(row)
        return ProfessionalFinancialResponse.model_validate(row)
    fin = ProfessionalFinancial(
        professional_id=professional_id,
        cnpj=body.cnpj,
        razao_social=body.razao_social,
        pix_key=body.pix_key,
        bank_data=body.bank_data,
        repasse_model=body.repasse_model,
    )
    db.add(fin)
    db.commit()
    db.refresh(fin)
    return ProfessionalFinancialResponse.model_validate(fin)


# ---- Termos de aceite (Story 3.4) ----
@router.get("/{professional_id}/terms", response_model=list[ProfessionalTermAcceptanceResponse])
def list_professional_terms(
    professional_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Lista aceites de termos do profissional."""
    if not _load_professional_with_units(db, professional_id, organization_id):
        raise HTTPException(status_code=404, detail="Profissional nao encontrado.")
    rows = (
        db.execute(
            select(ProfessionalTermAcceptance).where(
                ProfessionalTermAcceptance.professional_id == professional_id
            ).order_by(ProfessionalTermAcceptance.accepted_at.desc())
        )
        .scalars()
        .all()
    )
    return [ProfessionalTermAcceptanceResponse.model_validate(r) for r in rows]


@router.post("/{professional_id}/terms", response_model=ProfessionalTermAcceptanceResponse, status_code=201)
def accept_professional_term(
    professional_id: str,
    body: ProfessionalTermAcceptRequest,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Registra aceite de termo pelo profissional."""
    if not _load_professional_with_units(db, professional_id, organization_id):
        raise HTTPException(status_code=404, detail="Profissional nao encontrado.")
    term = ProfessionalTermAcceptance(
        professional_id=professional_id,
        term_type=body.term_type,
        term_version=body.term_version,
        accepted_by=user_id,
    )
    db.add(term)
    db.commit()
    db.refresh(term)
    return ProfessionalTermAcceptanceResponse.model_validate(term)
