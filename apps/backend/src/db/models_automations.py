"""Modelos SQLAlchemy para o módulo Automations."""
import uuid
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Text, Integer, Boolean, DateTime,
    ForeignKey, Index, func
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB

from src.db.session import Base

logger = logging.getLogger("completepay.automations")


def _uuid_str() -> str:
    return str(uuid.uuid4())


class AutomationWorkflow(Base):
    __tablename__ = "automation_workflows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="DRAFT"
    )  # DRAFT | PUBLISHED | DISABLED
    current_version_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True  # FK adicionada via ALTER TABLE em migrate_db.py
    )
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("ix_automation_workflows_org_status", "organization_id", "status"),
    )


class AutomationWorkflowVersion(Base):
    __tablename__ = "automation_workflow_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    workflow_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("automation_workflows.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    definition_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AutomationExecution(Base):
    __tablename__ = "automation_executions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    workflow_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("automation_workflows.id", ondelete="CASCADE"),
        nullable=False
    )
    version_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("automation_workflow_versions.id", ondelete="SET NULL"),
        nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="RUNNING"
    )  # RUNNING | SUCCESS | FAILED | CANCELED
    trigger_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # manual | webhook | system
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    initiated_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    error_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_automation_executions_wf_id", "workflow_id"),
    )


class AutomationExecutionStep(Base):
    __tablename__ = "automation_execution_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    execution_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("automation_executions.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    node_id: Mapped[str] = mapped_column(String(36), nullable=False)
    node_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="RUNNING")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    input_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    output_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class AutomationWebhookEndpoint(Base):
    __tablename__ = "automation_webhook_endpoints"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    workflow_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("automation_workflows.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    path_slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    secret_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
