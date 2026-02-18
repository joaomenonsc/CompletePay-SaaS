"""Rotas REST para agentes (CRUD). Exige autenticacao e contexto de organizacao (X-Organization-Id)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.deps import require_organization_id
from src.api.middleware.auth import require_user_id
from src.db.models import AgentConfig
from src.db.session import get_db
from src.schemas.agent import AgentCreate, AgentResponse, AgentUpdate

router = APIRouter(prefix="/agents", tags=["agents"])


def _get_agent_or_404(
    db: Session, agent_id: str, user_id: str, organization_id: str
) -> AgentConfig:
    agent = db.execute(
        select(AgentConfig).where(
            AgentConfig.id == agent_id,
            AgentConfig.user_id == user_id,
            AgentConfig.organization_id == organization_id,
        )
    ).scalars().one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente nao encontrado.")
    return agent


@router.get("", response_model=list[AgentResponse])
def list_agents(
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Lista agentes da organizacao do usuario (header X-Organization-Id obrigatorio)."""
    rows = (
        db.execute(
            select(AgentConfig)
            .where(
                AgentConfig.user_id == user_id,
                AgentConfig.organization_id == organization_id,
            )
            .order_by(AgentConfig.updated_at.desc())
        )
        .scalars().all()
    )
    return [AgentResponse.from_orm_row(r) for r in rows]


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(
    agent_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Retorna um agente por id (da organizacao atual)."""
    agent = _get_agent_or_404(db, agent_id, user_id, organization_id)
    return AgentResponse.from_orm_row(agent)


@router.post("", response_model=AgentResponse, status_code=201)
def create_agent(
    body: AgentCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Cria um novo agente na organizacao (header X-Organization-Id obrigatorio)."""
    agent = AgentConfig(
        user_id=user_id,
        organization_id=organization_id,
        name=body.name,
        description=body.description,
        image_url=body.image_url,
        status=body.status,
        model=body.model,
        system_instructions=body.system_instructions or "",
        category=body.category,
        template_id=body.template_id,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return AgentResponse.from_orm_row(agent)


@router.put("/{agent_id}", response_model=AgentResponse)
def update_agent(
    agent_id: str,
    body: AgentUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Atualiza um agente (partial update) na organizacao."""
    agent = _get_agent_or_404(db, agent_id, user_id, organization_id)
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(agent, key, value)
    db.commit()
    db.refresh(agent)
    return AgentResponse.from_orm_row(agent)


@router.delete("/{agent_id}", status_code=204)
def delete_agent(
    agent_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """Remove um agente da organizacao."""
    agent = _get_agent_or_404(db, agent_id, user_id, organization_id)
    db.delete(agent)
    db.commit()
    return None
