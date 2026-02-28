"""Rotas CRM: Unidades de atendimento e salas. Story 3.3."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.deps import require_organization_id, require_org_role
from src.api.middleware.auth import require_user_id
from src.db.models_crm import Room, Unit
from src.db.session import get_db
from src.schemas.crm import (
    RoomCreate,
    RoomResponse,
    RoomUpdate,
    UnitCreate,
    UnitResponse,
    UnitUpdate,
)

logger = logging.getLogger("completepay.crm")

router = APIRouter(prefix="/units", tags=["crm-units"])

ROLES_READ = ["rcp", "fin", "enf", "med", "gcl", "mkt"]
ROLES_WRITE = ["gcl"]


@router.get("", response_model=list[UnitResponse])
def list_units(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Lista unidades da organizacao."""
    rows = (
        db.execute(
            select(Unit)
            .where(Unit.organization_id == organization_id)
            .order_by(Unit.name)
        )
        .scalars()
        .all()
    )
    return [UnitResponse.model_validate(u) for u in rows]


@router.post("", response_model=UnitResponse, status_code=201)
def create_unit(
    body: UnitCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria unidade de atendimento."""
    unit = Unit(
        organization_id=organization_id,
        name=body.name.strip(),
        is_active=body.is_active,
        timezone=body.timezone,
        default_slot_minutes=body.default_slot_minutes,
        min_advance_minutes=body.min_advance_minutes,
        max_advance_days=body.max_advance_days,
        cancellation_policy=body.cancellation_policy,
        specialities=body.specialities,
        modalities=body.modalities,
        convenio_ids=body.convenio_ids,
    )
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return UnitResponse.model_validate(unit)


@router.get("/{unit_id}", response_model=UnitResponse)
def get_unit(
    unit_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna unidade por ID."""
    row = (
        db.execute(
            select(Unit).where(
                Unit.id == unit_id,
                Unit.organization_id == organization_id,
            )
        )
        .scalars()
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Unidade nao encontrada.")
    return UnitResponse.model_validate(row)


@router.patch("/{unit_id}", response_model=UnitResponse)
def update_unit(
    unit_id: str,
    body: UnitUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza unidade (parcial)."""
    row = (
        db.execute(
            select(Unit).where(
                Unit.id == unit_id,
                Unit.organization_id == organization_id,
            )
        )
        .scalars()
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Unidade nao encontrada.")
    unit = row
    payload = body.model_dump(exclude_unset=True)
    if "name" in payload and payload["name"]:
        payload["name"] = payload["name"].strip()
    for k, v in payload.items():
        setattr(unit, k, v)
    db.commit()
    db.refresh(unit)
    return UnitResponse.model_validate(unit)


def _get_unit_or_404(db: Session, unit_id: str, organization_id: str) -> Unit:
    row = (
        db.execute(
            select(Unit).where(
                Unit.id == unit_id,
                Unit.organization_id == organization_id,
            )
        )
        .scalars()
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Unidade nao encontrada.")
    return row


# ---- Salas ----
@router.get("/{unit_id}/rooms", response_model=list[RoomResponse])
def list_rooms(
    unit_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Lista salas da unidade."""
    _get_unit_or_404(db, unit_id, organization_id)
    rows = (
        db.execute(
            select(Room).where(Room.unit_id == unit_id).order_by(Room.name)
        )
        .scalars()
        .all()
    )
    return [RoomResponse.model_validate(r) for r in rows]


@router.post("/{unit_id}/rooms", response_model=RoomResponse, status_code=201)
def create_room(
    unit_id: str,
    body: RoomCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria sala na unidade."""
    _get_unit_or_404(db, unit_id, organization_id)
    room = Room(
        unit_id=unit_id,
        name=body.name.strip(),
        capacity=body.capacity,
        equipment_notes=body.equipment_notes,
        is_active=body.is_active,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return RoomResponse.model_validate(room)


@router.patch("/{unit_id}/rooms/{room_id}", response_model=RoomResponse)
def update_room(
    unit_id: str,
    room_id: str,
    body: RoomUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza sala (parcial)."""
    _get_unit_or_404(db, unit_id, organization_id)
    row = (
        db.execute(
            select(Room).where(
                Room.id == room_id,
                Room.unit_id == unit_id,
            )
        )
        .scalars()
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Sala nao encontrada.")
    payload = body.model_dump(exclude_unset=True)
    if "name" in payload and payload.get("name"):
        payload["name"] = payload["name"].strip()
    for k, v in payload.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return RoomResponse.model_validate(row)


@router.delete("/{unit_id}/rooms/{room_id}", status_code=204)
def delete_room(
    unit_id: str,
    room_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Exclui sala."""
    _get_unit_or_404(db, unit_id, organization_id)
    row = (
        db.execute(
            select(Room).where(
                Room.id == room_id,
                Room.unit_id == unit_id,
            )
        )
        .scalars()
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Sala nao encontrada.")
    db.delete(row)
    db.commit()
