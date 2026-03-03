"""Endpoint público de webhook — protegido por secret token, sem JWT."""
import hashlib
import hmac
import logging
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from src.api.deps import get_db
from src.schemas.automations import WebhookTriggerBody
from src.services import automation_service

logger = logging.getLogger("completepay.automations.webhook")
webhook_router = APIRouter(prefix="/api/v1/automations", tags=["automations-webhook"])


@webhook_router.post("/webhooks/{path_slug}")
def receive_webhook(
    path_slug: str,
    body: WebhookTriggerBody,
    x_webhook_secret: str = Header(None, alias="X-Webhook-Secret"),
    db: Session = Depends(get_db),
):
    """
    Endpoint público. Autenticação via X-Webhook-Secret (sem JWT).
    IMPORTANTE: prefixo registrado em PUBLIC_ROUTES em auth.py middleware.
    """
    endpoint = automation_service.get_webhook_endpoint(db, path_slug)
    if not endpoint or not endpoint.is_active:
        raise HTTPException(status_code=404, detail="Webhook não encontrado.")

    if not x_webhook_secret:
        raise HTTPException(status_code=401, detail="X-Webhook-Secret obrigatório.")

    provided_hash = hashlib.sha256(x_webhook_secret.encode()).hexdigest()
    if not hmac.compare_digest(provided_hash, endpoint.secret_hash):
        raise HTTPException(status_code=401, detail="Secret token inválido.")

    payload = body.model_dump()
    try:
        execution = automation_service.trigger_execution_webhook(
            db, endpoint.workflow_id, payload, path_slug
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    db.commit()
    return {"execution_id": execution.id, "status": execution.status}
