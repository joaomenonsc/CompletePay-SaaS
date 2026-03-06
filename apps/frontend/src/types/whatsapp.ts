/**
 * Tipos TypeScript do módulo WhatsApp.
 * Espelha os schemas Pydantic do backend em src/schemas/whatsapp.py
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type WAProvider = "evolution" | "waha" | "meta_official";

export type WAConversationStatus = "open" | "resolved" | "archived";

export type WAMessageDirection = "inbound" | "outbound";

export type WAMessageStatus =
    | "pending"
    | "sent"
    | "delivered"
    | "read"
    | "failed";

export type WATemplateStatus =
    | "draft"
    | "pending_review"
    | "approved"
    | "rejected";

export type WACampaignStatus =
    | "draft"
    | "scheduled"
    | "running"
    | "paused"
    | "completed"
    | "failed";

// ── Account ───────────────────────────────────────────────────────────────────

export interface WAAccount {
    id: string;
    organization_id: string;
    display_name: string;
    phone_number: string;
    provider: WAProvider;
    instance_name?: string;
    api_base_url?: string;
    status: "pending" | "connected" | "disconnected" | "error";
    is_default: boolean;
    is_deleted: boolean;
    created_at: string;
    updated_at: string;
}

export interface WAAccountCreate {
    display_name: string;
    phone_number: string;
    provider: WAProvider;
    instance_name?: string;
    api_base_url?: string;
    api_key?: string;
    webhook_secret?: string;
    is_default: boolean;
}

export interface WAAccountUpdate {
    display_name?: string;
    instance_name?: string;
    api_base_url?: string;
    api_key?: string;
    webhook_secret?: string;
    is_default?: boolean;
}

export interface WAQRCode {
    account_id: string;
    qrcode_base64?: string;
    status: "available" | "pending" | "error";
    message?: string;
}

export interface WAAccountListResponse {
    items: WAAccount[];
    total: number;
    limit: number;
    offset: number;
}

// ── Contact ───────────────────────────────────────────────────────────────────

export interface WAContact {
    id: string;
    organization_id: string;
    phone_normalized: string;
    phone_e164: string;
    phone_display?: string;
    display_name?: string;
    profile_picture_url?: string;
    opted_out: boolean;
    opted_out_at?: string;
    patient_id?: string;
    tags?: string[];
    is_deleted: boolean;
    created_at: string;
    updated_at?: string;
}

// ── Conversation ──────────────────────────────────────────────────────────────

export interface WAConversation {
    id: string;
    organization_id: string;
    account_id: string;
    contact_id: string;
    contact?: WAContact;
    status: WAConversationStatus;
    assigned_to?: string;
    unread_count: number;
    last_message_at?: string;
    last_message_preview?: string;
    first_response_at?: string;
    resolved_at?: string;
    sla_deadline?: string;
    tags?: string[];
    is_deleted: boolean;
    created_at: string;
}

export interface WAConversationUpdate {
    status?: WAConversationStatus;
    assigned_to?: string | null;
    tags?: string[];
    sla_deadline?: string;
}

export interface WAConversationListResponse {
    items: WAConversation[];
    total: number;
    limit: number;
    offset: number;
}

// ── Message ───────────────────────────────────────────────────────────────────

export interface WAMessage {
    id: string;
    organization_id: string;
    conversation_id: string;
    contact_id: string;
    external_message_id: string;
    client_pending_id?: string;
    direction: WAMessageDirection;
    message_type: string;
    status: WAMessageStatus;
    body_text?: string;
    media_url?: string;
    media_type?: string;
    media_filename?: string;
    template_id?: string;
    template_variables?: Record<string, string>;
    sender_user_id?: string;
    error_message?: string;
    sent_at?: string;
    delivered_at?: string;
    read_at?: string;
    failed_at?: string;
    created_at: string;
    is_group_message?: boolean;
    sender_name?: string;
    sender_phone?: string;
}

export interface WAMessageListResponse {
    items: WAMessage[];
    total: number;
    limit: number;
    offset: number;
}

export interface WASendTextInput {
    body_text: string;
    client_pending_id?: string;
}

export interface WAEditTextInput {
    body_text: string;
}

export interface WASendTemplateInput {
    template_id: string;
    variables?: Record<string, string>;
    client_pending_id?: string;
}

export interface WASendMediaInput {
    file: File;
    caption?: string;
    client_pending_id?: string;
}

// ── Template ──────────────────────────────────────────────────────────────────

export interface WATemplate {
    id: string;
    organization_id: string;
    account_id?: string;
    name: string;
    category: string;
    language: string;
    status: WATemplateStatus;
    body_text: string;
    header_type?: string;
    header_content?: string;
    footer_text?: string;
    variables?: string[];
    buttons?: Record<string, unknown>[];
    rejected_reason?: string;
    is_deleted: boolean;
    created_at: string;
    updated_at: string;
}

export interface WATemplateCreate {
    name: string;
    category: string;
    language: string;
    body_text: string;
    account_id?: string;
    header_type?: string;
    header_content?: string;
    footer_text?: string;
    variables?: string[];
    buttons?: Record<string, unknown>[];
}

export interface WATemplateUpdate {
    name?: string;
    body_text?: string;
    header_type?: string;
    header_content?: string;
    footer_text?: string;
    variables?: string[];
    buttons?: Record<string, unknown>[];
}

export interface WATemplateListResponse {
    items: WATemplate[];
    total: number;
    limit: number;
    offset: number;
}

// ── Campaign ──────────────────────────────────────────────────────────────────

export interface WACampaign {
    id: string;
    organization_id: string;
    account_id: string;
    name: string;
    template_id: string;
    template_variables_default?: Record<string, string>;
    segment_filter?: Record<string, unknown>;
    status: WACampaignStatus;
    scheduled_at?: string;
    started_at?: string;
    completed_at?: string;
    messages_per_minute: number;
    total_recipients: number;
    sent_count: number;
    delivered_count: number;
    read_count: number;
    failed_count: number;
    is_deleted: boolean;
    created_at: string;
}

export interface WACampaignCreate {
    account_id: string;
    name: string;
    template_id: string;
    template_variables_default?: Record<string, string>;
    segment_filter?: Record<string, unknown>;
    scheduled_at?: string;
    messages_per_minute?: number;
}

export interface WACampaignListResponse {
    items: WACampaign[];
    total: number;
    limit: number;
    offset: number;
}

export interface WACampaignProgress {
    campaign_id: string;
    status: WACampaignStatus;
    total_recipients: number;
    sent_count: number;
    delivered_count: number;
    read_count: number;
    failed_count: number;
    pending_count: number;
    completion_percent: number;
    estimated_finish_at?: string;
}

export interface WAPreviewRecipients {
    total: number;
    sample: { contact_id: string; phone: string; name?: string }[];
    opted_out_excluded: number;
}

// ── Automation Trigger ────────────────────────────────────────────────────────

export interface WATrigger {
    id: string;
    organization_id: string;
    account_id: string;
    name: string;
    event_type: string;
    workflow_id: string;
    conditions?: Record<string, unknown>;
    is_active: boolean;
    priority: number;
    last_triggered_at?: string;
    last_error?: string;
    created_at: string;
}

export interface WATriggerCreate {
    account_id: string;
    name: string;
    event_type: string;
    workflow_id: string;
    conditions?: Record<string, unknown>;
    is_active?: boolean;
    priority?: number;
}

export interface WATriggerListResponse {
    items: WATrigger[];
    total: number;
    limit: number;
    offset: number;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export interface WAMetrics {
    period: string;
    total_conversations: number;
    open_conversations: number;
    resolved_conversations: number;
    new_contacts: number;
    messages_sent: number;
    messages_received: number;
    avg_response_time_seconds?: number;
    sla_breached_count: number;
    opt_out_count: number;
}

// ── AI ────────────────────────────────────────────────────────────────────────

export interface WAAISuggestReply {
    conversation_id: string;
    suggested_reply?: string;
    available: boolean;
}

export interface WAAISummarize {
    conversation_id: string;
    summary?: string;
    available: boolean;
}
