/**
 * Cliente da API WhatsApp.
 * Usa o mesmo apiClient (JWT + X-Organization-Id).
 */

import apiClient from "@/lib/api/client";
import type {
    WAAccount,
    WAAccountCreate,
    WAAccountListResponse,
    WAAccountUpdate,
    WAAISuggestReply,
    WAAISummarize,
    WACampaign,
    WACampaignCreate,
    WACampaignListResponse,
    WACampaignProgress,
    WAConversation,
    WAConversationListResponse,
    WAConversationUpdate,
    WAMessage,
    WAMessageListResponse,
    WAMetrics,
    WAPreviewRecipients,
    WAQRCode,
    WASendTemplateInput,
    WASendTextInput,
    WATemplate,
    WATemplateCreate,
    WATemplateListResponse,
    WATemplateUpdate,
    WATrigger,
    WATriggerCreate,
    WATriggerListResponse,
} from "@/types/whatsapp";

const BASE = "/api/v1/whatsapp";

// ── Accounts ──────────────────────────────────────────────────────────────────

export async function fetchAccounts(params?: {
    limit?: number;
    offset?: number;
}): Promise<WAAccountListResponse> {
    const { data } = await apiClient.get(`${BASE}/accounts`, { params });
    return data;
}

export async function fetchAccount(id: string): Promise<WAAccount> {
    const { data } = await apiClient.get(`${BASE}/accounts/${id}`);
    return data;
}

export async function createAccount(body: WAAccountCreate): Promise<WAAccount> {
    const { data } = await apiClient.post(`${BASE}/accounts`, body);
    return data;
}

export async function updateAccount(
    id: string,
    body: WAAccountUpdate
): Promise<WAAccount> {
    const { data } = await apiClient.patch(`${BASE}/accounts/${id}`, body);
    return data;
}

export async function deleteAccount(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/accounts/${id}`);
}

export async function fetchQRCode(accountId: string): Promise<WAQRCode> {
    const { data } = await apiClient.get(
        `${BASE}/accounts/${accountId}/qrcode`
    );
    return data;
}

export async function syncAccountStatus(accountId: string): Promise<WAAccount> {
    const { data } = await apiClient.post(
        `${BASE}/accounts/${accountId}/sync-status`
    );
    return data;
}

export async function rotateWebhookSecret(
    accountId: string,
    webhookSecret: string
): Promise<{ status: string }> {
    const { data } = await apiClient.post(
        `${BASE}/accounts/${accountId}/webhook-secret`,
        { webhook_secret: webhookSecret }
    );
    return data;
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function fetchConversations(params?: {
    status?: string;
    assigned_to?: string;
    account_id?: string;
    limit?: number;
    offset?: number;
}): Promise<WAConversationListResponse> {
    const { data } = await apiClient.get(`${BASE}/conversations`, { params });
    return data;
}

export async function fetchConversation(id: string): Promise<WAConversation> {
    const { data } = await apiClient.get(`${BASE}/conversations/${id}`);
    return data;
}

export async function updateConversation(
    id: string,
    body: WAConversationUpdate
): Promise<WAConversation> {
    const { data } = await apiClient.patch(
        `${BASE}/conversations/${id}`,
        body
    );
    return data;
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function fetchMessages(
    conversationId: string,
    params?: { limit?: number; offset?: number }
): Promise<WAMessageListResponse> {
    const { data } = await apiClient.get(
        `${BASE}/conversations/${conversationId}/messages`,
        { params }
    );
    return data;
}

export async function sendTextMessage(
    conversationId: string,
    body: WASendTextInput
): Promise<WAMessage> {
    const { data } = await apiClient.post(
        `${BASE}/conversations/${conversationId}/messages/text`,
        body
    );
    return data;
}

export async function sendTemplateMessage(
    conversationId: string,
    body: WASendTemplateInput
): Promise<WAMessage> {
    const { data } = await apiClient.post(
        `${BASE}/conversations/${conversationId}/messages/template`,
        body
    );
    return data;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function fetchTemplates(params?: {
    status?: string;
    account_id?: string;
    limit?: number;
    offset?: number;
}): Promise<WATemplateListResponse> {
    const { data } = await apiClient.get(`${BASE}/templates`, { params });
    return data;
}

export async function fetchTemplate(id: string): Promise<WATemplate> {
    const { data } = await apiClient.get(`${BASE}/templates/${id}`);
    return data;
}

export async function createTemplate(
    body: WATemplateCreate
): Promise<WATemplate> {
    const { data } = await apiClient.post(`${BASE}/templates`, body);
    return data;
}

export async function updateTemplate(
    id: string,
    body: WATemplateUpdate
): Promise<WATemplate> {
    const { data } = await apiClient.patch(`${BASE}/templates/${id}`, body);
    return data;
}

export async function deleteTemplate(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/templates/${id}`);
}

export async function submitTemplate(id: string): Promise<WATemplate> {
    const { data } = await apiClient.post(`${BASE}/templates/${id}/submit`);
    return data;
}

export async function approveTemplate(id: string): Promise<WATemplate> {
    const { data } = await apiClient.post(`${BASE}/templates/${id}/approve`);
    return data;
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export async function fetchCampaigns(params?: {
    status?: string;
    limit?: number;
    offset?: number;
}): Promise<WACampaignListResponse> {
    const { data } = await apiClient.get(`${BASE}/campaigns`, { params });
    return data;
}

export async function fetchCampaign(id: string): Promise<WACampaign> {
    const { data } = await apiClient.get(`${BASE}/campaigns/${id}`);
    return data;
}

export async function createCampaign(
    body: WACampaignCreate
): Promise<WACampaign> {
    const { data } = await apiClient.post(`${BASE}/campaigns`, body);
    return data;
}

export async function startCampaign(id: string): Promise<WACampaign> {
    const { data } = await apiClient.post(`${BASE}/campaigns/${id}/start`);
    return data;
}

export async function pauseCampaign(id: string): Promise<WACampaign> {
    const { data } = await apiClient.post(`${BASE}/campaigns/${id}/pause`);
    return data;
}

export async function fetchCampaignProgress(
    id: string
): Promise<WACampaignProgress> {
    const { data } = await apiClient.get(`${BASE}/campaigns/${id}/progress`);
    return data;
}

export async function previewRecipients(params?: {
    tags?: string;
}): Promise<WAPreviewRecipients> {
    const { data } = await apiClient.get(
        `${BASE}/campaigns/preview-recipients`,
        { params }
    );
    return data;
}

// ── Automation Triggers ───────────────────────────────────────────────────────

export async function fetchTriggers(params?: {
    account_id?: string;
    limit?: number;
    offset?: number;
}): Promise<WATriggerListResponse> {
    const { data } = await apiClient.get(
        `${BASE}/automation-triggers`,
        { params }
    );
    return data;
}

export async function createTrigger(
    body: WATriggerCreate
): Promise<WATrigger> {
    const { data } = await apiClient.post(`${BASE}/automation-triggers`, body);
    return data;
}

export async function deleteTrigger(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/automation-triggers/${id}`);
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export async function fetchMetricsOverview(
    period?: "1d" | "7d" | "30d" | "90d"
): Promise<WAMetrics> {
    const { data } = await apiClient.get(`${BASE}/metrics/overview`, {
        params: { period: period ?? "7d" },
    });
    return data;
}

// ── AI Copiloto ───────────────────────────────────────────────────────────────

export async function fetchSuggestReply(
    conversationId: string
): Promise<WAAISuggestReply> {
    const { data } = await apiClient.get(
        `${BASE}/conversations/${conversationId}/ai/suggest-reply`
    );
    return data;
}

export async function fetchSummarize(
    conversationId: string
): Promise<WAAISummarize> {
    const { data } = await apiClient.get(
        `${BASE}/conversations/${conversationId}/ai/summarize`
    );
    return data;
}
