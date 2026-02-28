/** Tipos do módulo Email Marketing */

// ── Templates ──────────────────────────────────────────────────────────────────

export type TemplateCategory =
    | "reengajamento"
    | "comunicado"
    | "check-up"
    | "nps"
    | "boas-vindas"
    | "newsletter"
    | "custom";

export interface EmailTemplate {
    id: string;
    organization_id: string;
    name: string;
    category: string;
    subject_template: string | null;
    html_content: string | null;
    blocks_json: string | null;
    variables: string[] | null;
    is_starter: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface EmailTemplateCreateInput {
    name: string;
    subject_template?: string | null;
    html_content?: string | null;
    blocks_json?: string | null;
    variables?: string[];
    category?: string;
}

export interface EmailTemplateUpdateInput {
    name?: string;
    subject_template?: string | null;
    html_content?: string | null;
    blocks_json?: string | null;
    variables?: string[];
    category?: string;
}

export interface EmailTemplateListResponse {
    items: EmailTemplate[];
    total: number;
    limit: number;
    offset: number;
}

// ── Listas / Segmentos ─────────────────────────────────────────────────────────

export type ListType = "static" | "dynamic";

export interface EmailList {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    list_type: string;
    filter_criteria: Record<string, unknown> | null;
    subscriber_count: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface EmailListCreateInput {
    name: string;
    description?: string | null;
    list_type?: string;
    filter_criteria?: Record<string, unknown> | null;
}

export interface EmailListListResponse {
    items: EmailList[];
    total: number;
    limit: number;
    offset: number;
}

// ── Subscribers ────────────────────────────────────────────────────────────────

export type SubscriberStatus = "active" | "unsubscribed" | "bounced" | "complained";

export interface EmailSubscriber {
    id: string;
    organization_id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    patient_id: string | null;
    status: SubscriberStatus;
    tags: string[];
    custom_fields: Record<string, unknown>;
    subscribed_at: string;
    unsubscribed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface SubscriberListResponse {
    items: EmailSubscriber[];
    total: number;
    limit: number;
    offset: number;
}

// ── Campanhas ──────────────────────────────────────────────────────────────────

export type CampaignStatus =
    | "draft"
    | "scheduled"
    | "sending"
    | "sent"
    | "partial"
    | "failed"
    | "cancelled";

export interface EmailCampaign {
    id: string;
    organization_id: string;
    name: string;
    subject: string;
    template_id: string | null;
    list_id: string | null;
    from_email: string | null;
    from_name: string | null;
    reply_to: string | null;
    status: CampaignStatus;
    scheduled_at: string | null;
    sent_at: string | null;
    total_recipients: number;
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_bounced: number;
    total_unsubscribed: number;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface CampaignCreateInput {
    name: string;
    subject: string;
    template_id?: string | null;
    list_id?: string | null;
    from_email?: string | null;
    from_name?: string | null;
    reply_to?: string | null;
    scheduled_at?: string | null;
}

export interface CampaignUpdateInput {
    name?: string;
    subject?: string;
    template_id?: string | null;
    list_id?: string | null;
    from_email?: string | null;
    from_name?: string | null;
    reply_to?: string | null;
    scheduled_at?: string | null;
}

export interface CampaignListResponse {
    items: EmailCampaign[];
    total: number;
    limit: number;
    offset: number;
}

// ── Sends ──────────────────────────────────────────────────────────────────────

export type SendStatus =
    | "pending"
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "bounced"
    | "failed"
    | "complained";

export interface EmailSend {
    id: string;
    campaign_id: string;
    subscriber_id: string;
    esp_message_id: string | null;
    status: SendStatus;
    sent_at: string | null;
    delivered_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    bounced_at: string | null;
    error_message: string | null;
    retry_count: number;
    created_at: string;
}

// ── Métricas ───────────────────────────────────────────────────────────────────

export interface CampaignMetrics {
    campaign_id: string;
    total_recipients: number;
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_bounced: number;
    total_unsubscribed: number;
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
    bounce_rate: number;
    unsubscribe_rate: number;
}

export interface OverviewMetrics {
    total_campaigns: number;
    total_sent: number;
    avg_open_rate: number;
    avg_click_rate: number;
    avg_bounce_rate: number;
    recent_campaigns: EmailCampaign[];
}

// ── Domínios ───────────────────────────────────────────────────────────────────

export type DomainStatus = "pending" | "verified" | "failed";

export type TlsMode = "opportunistic" | "enforced";

export interface DnsRecord {
    record_type: string;
    name: string;
    content: string;
    ttl: string;
    priority: number | null;
    status: "pending" | "verified";
}

export interface EmailDomain {
    id: string;
    organization_id: string;
    domain: string;
    status: DomainStatus;
    region: string;
    provider: string | null;
    click_tracking: boolean;
    open_tracking: boolean;
    tls_mode: TlsMode;
    dns_records: DnsRecord[] | null;
    verified_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface DomainCreateInput {
    domain: string;
    region?: string;
}

export interface DomainUpdateInput {
    click_tracking?: boolean;
    open_tracking?: boolean;
    tls_mode?: TlsMode;
}

export interface DomainListResponse {
    items: EmailDomain[];
    total: number;
    limit: number;
    offset: number;
}
