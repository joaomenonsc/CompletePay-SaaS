"""Schemas Pydantic v2 para o módulo Automations."""
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    definition: Optional[dict[str, Any]] = None


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    definition: Optional[dict[str, Any]] = None


class WorkflowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    name: str
    description: Optional[str]
    status: str
    current_version_id: Optional[str]
    created_by: Optional[str]
    updated_by: Optional[str]
    created_at: datetime
    updated_at: datetime


class WorkflowVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    workflow_id: str
    version_number: int
    definition_json: dict[str, Any]
    published_at: Optional[datetime]
    created_at: datetime


class PublishBody(BaseModel):
    definition: dict[str, Any]


class ExecutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    workflow_id: str
    version_id: Optional[str]
    status: str
    trigger_type: str
    started_at: datetime
    finished_at: Optional[datetime]
    duration_ms: Optional[int]
    initiated_by: Optional[str]
    error_summary: Optional[str]


class ExecutionStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    execution_id: str
    node_id: str
    node_type: str
    status: str
    started_at: datetime
    finished_at: Optional[datetime]
    duration_ms: Optional[int]
    input_json: Optional[dict[str, Any]]
    output_json: Optional[dict[str, Any]]
    error_message: Optional[str]


class WebhookTriggerBody(BaseModel):
    model_config = ConfigDict(extra="allow")


class ManualExecuteBody(BaseModel):
    payload: Optional[dict[str, Any]] = Field(default_factory=dict)
