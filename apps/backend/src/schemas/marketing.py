"""Schemas Pydantic para API de Email Marketing (request/response)."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Templates ────────────────────────────────────────────────────────────────


class TemplateCreate(BaseModel):
    """Payload para criar template."""
    name: str = Field(..., min_length=2, max_length=255)
    category: str = Field("geral", max_length=50)
    subject_template: Optional[str] = Field(None, max_length=500)
    html_content: Optional[str] = None
    blocks_json: Optional[str] = None
    variables: Optional[list[str]] = None


class TemplateUpdate(BaseModel):
    """Payload para atualizar template (parcial)."""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    category: Optional[str] = Field(None, max_length=50)
    subject_template: Optional[str] = Field(None, max_length=500)
    html_content: Optional[str] = None
    blocks_json: Optional[str] = None
    variables: Optional[list[str]] = None


class TemplateResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    category: str
    subject_template: Optional[str] = None
    html_content: Optional[str] = None
    blocks_json: Optional[str] = None
    variables: Optional[list[str]] = None
    is_starter: bool = False
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TemplateListResponse(BaseModel):
    items: list[TemplateResponse]
    total: int
    limit: int
    offset: int


class TemplatePreviewRequest(BaseModel):
    """Payload para preview de template."""
    variables: dict[str, str] = Field(default_factory=dict)


class TemplatePreviewResponse(BaseModel):
    """Resultado do preview renderizado."""
    subject: str
    html: str
    variables_used: list[str]


# ── Listas ───────────────────────────────────────────────────────────────────


class ListCreate(BaseModel):
    """Payload para criar lista."""
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    list_type: str = Field("static", pattern="^(static|dynamic)$")
    filter_criteria: Optional[dict] = None


class ListUpdate(BaseModel):
    """Payload para atualizar lista (parcial)."""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    filter_criteria: Optional[dict] = None


class ListResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    list_type: str
    filter_criteria: Optional[dict] = None
    subscriber_count: int = 0
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ListListResponse(BaseModel):
    items: list[ListResponse]
    total: int
    limit: int
    offset: int


# ── Subscribers ──────────────────────────────────────────────────────────────


class SubscriberCreate(BaseModel):
    email: str = Field(..., max_length=255)
    name: Optional[str] = Field(None, max_length=255)
    patient_id: Optional[str] = None


class SubscriberResponse(BaseModel):
    id: str
    organization_id: str
    email: str
    name: Optional[str] = None
    patient_id: Optional[str] = None
    status: str
    unsubscribed_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CsvImportResponse(BaseModel):
    """Resultado de importacao CSV."""
    total_rows: int
    created: int
    skipped: int
    errors: list[str]


class PatientSyncResponse(BaseModel):
    """Resultado do sync Patient→Subscriber."""
    synced: int
    unsubscribed: int
    skipped: int


# ── Campanhas ────────────────────────────────────────────────────────────────


class CampaignCreate(BaseModel):
    """Payload para criar campanha."""
    name: str = Field(..., min_length=2, max_length=255)
    subject: str = Field(..., min_length=2, max_length=500)
    template_id: Optional[str] = None
    list_id: Optional[str] = None
    from_email: Optional[str] = Field(None, max_length=255)
    from_name: Optional[str] = Field(None, max_length=255)
    reply_to: Optional[str] = Field(None, max_length=255)
    scheduled_at: Optional[datetime] = None


class CampaignUpdate(BaseModel):
    """Payload para atualizar campanha (parcial)."""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    subject: Optional[str] = Field(None, min_length=2, max_length=500)
    template_id: Optional[str] = None
    list_id: Optional[str] = None
    from_email: Optional[str] = Field(None, max_length=255)
    from_name: Optional[str] = Field(None, max_length=255)
    reply_to: Optional[str] = Field(None, max_length=255)
    scheduled_at: Optional[datetime] = None


class CampaignResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    subject: str
    template_id: Optional[str] = None
    list_id: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    reply_to: Optional[str] = None
    status: str
    scheduled_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    total_recipients: int = 0
    total_sent: int = 0
    total_delivered: int = 0
    total_opened: int = 0
    total_clicked: int = 0
    total_bounced: int = 0
    total_unsubscribed: int = 0
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CampaignScheduleRequest(BaseModel):
    """Payload para agendar campanha."""
    scheduled_at: datetime


class CampaignListResponse(BaseModel):
    items: list[CampaignResponse]
    total: int
    limit: int
    offset: int


# ── Métricas ─────────────────────────────────────────────────────────────────


class CampaignMetricsResponse(BaseModel):
    """Metricas detalhadas de uma campanha."""
    campaign_id: str
    total_recipients: int = 0
    total_sent: int = 0
    total_delivered: int = 0
    total_opened: int = 0
    total_clicked: int = 0
    total_bounced: int = 0
    total_unsubscribed: int = 0
    delivery_rate: float = 0.0
    open_rate: float = 0.0
    click_rate: float = 0.0
    bounce_rate: float = 0.0
    unsubscribe_rate: float = 0.0


class OverviewMetricsResponse(BaseModel):
    """Metricas globais do modulo de marketing."""
    total_campaigns: int = 0
    total_sent: int = 0
    avg_open_rate: float = 0.0
    avg_click_rate: float = 0.0
    avg_bounce_rate: float = 0.0
    recent_campaigns: list[CampaignResponse] = []


# ── Domínios ─────────────────────────────────────────────────────────────────


class DnsRecordResponse(BaseModel):
    """Registro DNS individual."""
    record_type: str  # TXT, MX, CNAME
    name: str
    content: str
    ttl: str = "Auto"
    priority: Optional[int] = None
    status: str = "pending"  # pending, verified


class DomainCreate(BaseModel):
    """Payload para adicionar domínio."""
    domain: str = Field(..., min_length=3, max_length=255)
    region: str = Field("sa-east-1", max_length=30)


class DomainUpdate(BaseModel):
    """Payload para atualizar configuração do domínio."""
    click_tracking: Optional[bool] = None
    open_tracking: Optional[bool] = None
    tls_mode: Optional[str] = Field(None, pattern="^(opportunistic|enforced)$")


class DomainResponse(BaseModel):
    id: str
    organization_id: str
    domain: str
    status: str
    region: str
    provider: Optional[str] = None
    click_tracking: bool = True
    open_tracking: bool = False
    tls_mode: str = "opportunistic"
    dns_records: Optional[list[DnsRecordResponse]] = None
    verified_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DomainListResponse(BaseModel):
    items: list[DomainResponse]
    total: int
    limit: int
    offset: int


# ── Inbound Emails ───────────────────────────────────────────────────────────


class InboundEmailResponse(BaseModel):
    """Resposta para consulta de emails inbound."""
    id: str
    organization_id: str
    from_email: str
    from_name: Optional[str] = None
    to_email: str
    subject: Optional[str] = None
    text_content: Optional[str] = None
    html_content: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class InboundEmailListResponse(BaseModel):
    """Lista de emails inbound."""
    items: list[InboundEmailResponse]
    total: int
    limit: int
    offset: int


class SingleEmailRequest(BaseModel):
    """Payload para envio de email unico."""
    to_email: str = Field(..., max_length=255)
    subject: str = Field(..., min_length=2, max_length=500)
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    from_name: Optional[str] = Field(None, max_length=255)
    from_email: Optional[str] = Field(None, max_length=255)

