"""Rotas CRM: Convênios/planos. Requer JWT + X-Organization-Id + RBAC."""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.deps import require_organization_id, require_org_role
from src.api.middleware.auth import require_user_id
from src.db.models_crm import Convenio
from src.db.session import get_db
from src.schemas.crm import ConvenioCreate, ConvenioResponse

logger = logging.getLogger("completepay.crm")

router = APIRouter(prefix="/convenios", tags=["crm-convenios"])

ROLES_READ = ["rcp", "fin", "enf", "med", "gcl", "mkt"]
ROLES_WRITE = ["rcp", "gcl"]


@router.get("", response_model=list[ConvenioResponse])
def list_convenios(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Lista convênios da organização."""
    rows = (
        db.execute(
            select(Convenio).where(Convenio.organization_id == organization_id).order_by(Convenio.name)
        )
        .scalars().all()
    )
    return [ConvenioResponse.model_validate(r[0]) for r in rows]


@router.post("", response_model=ConvenioResponse, status_code=201)
def create_convenio(
    body: ConvenioCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria convênio."""
    convenio = Convenio(organization_id=organization_id, name=body.name)
    db.add(convenio)
    db.commit()
    db.refresh(convenio)
    return ConvenioResponse.model_validate(convenio)
