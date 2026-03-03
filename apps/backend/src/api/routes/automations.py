"""Rotas FastAPI do módulo Automations — endpoints autenticados."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from src.api.deps import require_org_role, require_organization_id, get_db
from src.api.middleware.auth import require_user_id
from src.schemas.automations import (
    WorkflowCreate, WorkflowUpdate, WorkflowResponse, WorkflowVersionResponse,
    PublishBody, ExecutionResponse, ExecutionStepResponse, ManualExecuteBody
)
from src.services import automation_service
from src.services.audit_service import log_audit
from src.db.models_automations import AutomationExecution

logger = logging.getLogger("completepay.automations")
router = APIRouter(prefix="/api/v1/automations", tags=["automations"])

ROLES_READ = ["rcp", "fin", "enf", "med", "gcl", "mkt"]
ROLES_WRITE = ["gcl", "mkt", "med"]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_workflow_or_404(db: Session, workflow_id: str, org_id: str):
    wf = automation_service.get_workflow(db, workflow_id, org_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow não encontrado.")
    return wf


# ═══════════════════════════════════════════════════════════════════════════════
#  WORKFLOWS CRUD
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/workflows", response_model=list[WorkflowResponse])
def list_workflows(
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Lista workflows da organização com filtro por status."""
    return automation_service.list_workflows(db, organization_id, status=status, limit=limit, offset=offset)


@router.post("/workflows", response_model=WorkflowResponse, status_code=201)
def create_workflow(
    body: WorkflowCreate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Cria um novo workflow."""
    wf = automation_service.create_workflow(
        db,
        organization_id=organization_id,
        name=body.name,
        description=body.description,
        definition=body.definition,
        created_by=user_id,
    )
    db.commit()
    db.refresh(wf)
    return wf


@router.get("/workflows/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(
    workflow_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna detalhes de um workflow."""
    return _get_workflow_or_404(db, workflow_id, organization_id)


@router.put("/workflows/{workflow_id}", response_model=WorkflowResponse)
def update_workflow(
    workflow_id: str,
    body: WorkflowUpdate,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Atualiza workflow (nome, descrição, rascunho de definition)."""
    wf = _get_workflow_or_404(db, workflow_id, organization_id)
    wf = automation_service.update_workflow(
        db, wf,
        name=body.name,
        description=body.description,
        definition=body.definition,
        updated_by=user_id,
    )
    db.commit()
    db.refresh(wf)
    return wf


@router.delete("/workflows/{workflow_id}", status_code=204)
def delete_workflow(
    workflow_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Deleta workflow (apenas DRAFT). Retorna 204 sem body."""
    wf = _get_workflow_or_404(db, workflow_id, organization_id)
    try:
        automation_service.delete_workflow(db, wf)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
#  PUBLISH / DISABLE
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/workflows/{workflow_id}/publish", response_model=WorkflowVersionResponse)
def publish_workflow(
    workflow_id: str,
    body: PublishBody,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Valida, versiona e publica o workflow. Grava AuditLog obrigatório."""
    wf = _get_workflow_or_404(db, workflow_id, organization_id)
    try:
        version = automation_service.publish_workflow(db, wf, body.definition)
    except ValueError as e:
        errors = e.args[0] if e.args else str(e)
        raise HTTPException(status_code=422, detail={"validation_errors": errors})
    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="update", resource_type="automation_workflow",
        resource_id=workflow_id, data_classification="ADM",
        data_after={"status": "PUBLISHED", "version": version.version_number},
    )
    return version


@router.post("/workflows/{workflow_id}/disable", response_model=WorkflowResponse)
def disable_workflow(
    workflow_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_WRITE)),
    db: Session = Depends(get_db),
):
    """Desativa workflow. Grava AuditLog obrigatório."""
    wf = _get_workflow_or_404(db, workflow_id, organization_id)
    wf = automation_service.disable_workflow(db, wf)
    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="update", resource_type="automation_workflow",
        resource_id=workflow_id, data_classification="ADM",
        data_after={"status": "DISABLED"},
    )
    db.refresh(wf)
    return wf


# ═══════════════════════════════════════════════════════════════════════════════
#  EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/workflows/{workflow_id}/execute", response_model=ExecutionResponse)
def execute_workflow_manual(
    workflow_id: str,
    body: ManualExecuteBody,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Execução manual síncrona (timeout 60s). Grava AuditLog."""
    wf = _get_workflow_or_404(db, workflow_id, organization_id)
    if wf.status != "PUBLISHED":
        raise HTTPException(status_code=422, detail="Apenas workflows PUBLISHED podem ser executados.")

    # Buscar versão atual
    version = None
    if wf.current_version_id:
        from src.db.models_automations import AutomationWorkflowVersion
        version = db.query(AutomationWorkflowVersion).filter(
            AutomationWorkflowVersion.id == wf.current_version_id,
        ).first()

    if not version:
        raise HTTPException(status_code=422, detail="Nenhuma versão publicada encontrada.")

    execution = AutomationExecution(
        workflow_id=wf.id,
        version_id=version.id,
        status="RUNNING",
        trigger_type="manual",
        initiated_by=user_id,
    )
    db.add(execution)
    db.flush()

    initial_context = {"payload": body.payload or {}}
    execution = automation_service.execute_workflow_sync(
        db, execution, version.definition_json, initial_context
    )

    log_audit(
        db, organization_id=organization_id, user_id=user_id,
        action="create", resource_type="automation_execution",
        resource_id=execution.id, data_classification="AUD",
        data_after={"workflow_id": workflow_id, "status": execution.status},
    )

    db.refresh(execution)
    return execution


# ═══════════════════════════════════════════════════════════════════════════════
#  EXECUTIONS QUERIES
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/executions", response_model=list[ExecutionResponse])
def list_executions(
    workflow_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Lista execuções da organização com filtros."""
    return automation_service.list_executions(
        db, organization_id, workflow_id=workflow_id, status=status,
        limit=limit, offset=offset,
    )


@router.get("/executions/{execution_id}", response_model=ExecutionResponse)
def get_execution(
    execution_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna detalhes de uma execução."""
    ex = automation_service.get_execution(db, execution_id, organization_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Execução não encontrada.")
    return ex


@router.get("/executions/{execution_id}/steps", response_model=list[ExecutionStepResponse])
def get_execution_steps(
    execution_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Retorna steps de uma execução."""
    # Verificar se execução pertence à organização
    ex = automation_service.get_execution(db, execution_id, organization_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Execução não encontrada.")
    return automation_service.get_execution_steps(db, execution_id)


# ═══════════════════════════════════════════════════════════════════════════════
#  VERSIONS
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/workflows/{workflow_id}/versions", response_model=list[WorkflowVersionResponse])
def list_versions(
    workflow_id: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    _role: str = Depends(require_org_role(ROLES_READ)),
    db: Session = Depends(get_db),
):
    """Lista versões publicadas de um workflow."""
    wf = _get_workflow_or_404(db, workflow_id, organization_id)
    return automation_service.get_workflow_versions(db, workflow_id)
