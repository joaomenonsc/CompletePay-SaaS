/**
 * Cliente da API de Email Marketing.
 * Usa o mesmo apiClient (JWT + X-Organization-Id).
 */

import apiClient from "@/lib/api/client";
import type {
    CampaignCreateInput,
    CampaignListResponse,
    CampaignMetrics,
    CampaignUpdateInput,
    DomainCreateInput,
    DomainListResponse,
    DomainUpdateInput,
    EmailCampaign,
    EmailDomain,
    EmailList,
    EmailListCreateInput,
    EmailListListResponse,
    EmailTemplate,
    EmailTemplateCreateInput,
    EmailTemplateListResponse,
    EmailTemplateUpdateInput,
    OverviewMetrics,
    SubscriberListResponse,
} from "@/types/marketing";

const BASE = "/api/v1/email-marketing";

// ── Templates ──────────────────────────────────────────────────────────────────

export async function fetchTemplates(params?: {
    limit?: number;
    offset?: number;
    category?: string;
}): Promise<EmailTemplateListResponse> {
    const { data } = await apiClient.get(`${BASE}/templates`, { params });
    return data;
}

export async function fetchTemplate(id: string): Promise<EmailTemplate> {
    const { data } = await apiClient.get(`${BASE}/templates/${id}`);
    return data;
}

export async function createTemplate(
    body: EmailTemplateCreateInput
): Promise<EmailTemplate> {
    const { data } = await apiClient.post(`${BASE}/templates`, body);
    return data;
}

export async function updateTemplate(
    id: string,
    body: EmailTemplateUpdateInput
): Promise<EmailTemplate> {
    const { data } = await apiClient.put(`${BASE}/templates/${id}`, body);
    return data;
}

export async function deleteTemplate(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/templates/${id}`);
}

export async function previewTemplate(
    id: string,
    sampleData?: Record<string, string>
): Promise<{ html: string }> {
    const { data } = await apiClient.post(`${BASE}/templates/${id}/preview`, {
        sample_data: sampleData,
    });
    return data;
}

// ── Listas ─────────────────────────────────────────────────────────────────────

export async function fetchLists(params?: {
    limit?: number;
    offset?: number;
}): Promise<EmailListListResponse> {
    const { data } = await apiClient.get(`${BASE}/lists`, { params });
    return data;
}

export async function fetchList(id: string): Promise<EmailList> {
    const { data } = await apiClient.get(`${BASE}/lists/${id}`);
    return data;
}

export async function createList(body: EmailListCreateInput): Promise<EmailList> {
    const { data } = await apiClient.post(`${BASE}/lists`, body);
    return data;
}

export async function updateList(
    id: string,
    body: Partial<EmailListCreateInput>
): Promise<EmailList> {
    const { data } = await apiClient.put(`${BASE}/lists/${id}`, body);
    return data;
}

export async function deleteList(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/lists/${id}`);
}

export async function fetchListSubscribers(
    listId: string,
    params?: { limit?: number; offset?: number }
): Promise<SubscriberListResponse> {
    const { data } = await apiClient.get(`${BASE}/lists/${listId}/subscribers`, {
        params,
    });
    return data;
}

// ── Campanhas ──────────────────────────────────────────────────────────────────

export async function fetchCampaigns(params?: {
    limit?: number;
    offset?: number;
    status?: string;
}): Promise<CampaignListResponse> {
    const { data } = await apiClient.get(`${BASE}/campaigns`, { params });
    return data;
}

export async function fetchCampaign(id: string): Promise<EmailCampaign> {
    const { data } = await apiClient.get(`${BASE}/campaigns/${id}`);
    return data;
}

export async function createCampaign(
    body: CampaignCreateInput
): Promise<EmailCampaign> {
    const { data } = await apiClient.post(`${BASE}/campaigns`, body);
    return data;
}

export async function updateCampaign(
    id: string,
    body: CampaignUpdateInput
): Promise<EmailCampaign> {
    const { data } = await apiClient.put(`${BASE}/campaigns/${id}`, body);
    return data;
}

export async function sendCampaign(id: string): Promise<EmailCampaign> {
    const { data } = await apiClient.post(`${BASE}/campaigns/${id}/send`);
    return data;
}

export async function scheduleCampaign(
    id: string,
    scheduledAt: string
): Promise<EmailCampaign> {
    const { data } = await apiClient.post(`${BASE}/campaigns/${id}/schedule`, {
        scheduled_at: scheduledAt,
    });
    return data;
}

export async function cancelCampaign(id: string): Promise<EmailCampaign> {
    const { data } = await apiClient.post(`${BASE}/campaigns/${id}/cancel`);
    return data;
}

export async function deleteCampaign(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/campaigns/${id}`);
}

export async function duplicateCampaign(id: string): Promise<EmailCampaign> {
    const { data } = await apiClient.post(`${BASE}/campaigns/${id}/duplicate`);
    return data;
}

// ── Métricas ───────────────────────────────────────────────────────────────────

export async function fetchCampaignMetrics(
    campaignId: string
): Promise<CampaignMetrics> {
    const { data } = await apiClient.get(
        `${BASE}/campaigns/${campaignId}/analytics`
    );
    return data;
}

export async function fetchOverviewMetrics(): Promise<OverviewMetrics> {
    const { data } = await apiClient.get(`${BASE}/analytics/overview`);
    return data;
}

// ── Domínios ───────────────────────────────────────────────────────────────────

export async function fetchDomains(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    region?: string;
    q?: string;
}): Promise<DomainListResponse> {
    const { data } = await apiClient.get(`${BASE}/domains`, { params });
    return data;
}

export async function fetchDomain(id: string): Promise<EmailDomain> {
    const { data } = await apiClient.get(`${BASE}/domains/${id}`);
    return data;
}

export async function createDomain(body: DomainCreateInput): Promise<EmailDomain> {
    const { data } = await apiClient.post(`${BASE}/domains`, body);
    return data;
}

export async function updateDomain(
    id: string,
    body: DomainUpdateInput
): Promise<EmailDomain> {
    const { data } = await apiClient.put(`${BASE}/domains/${id}`, body);
    return data;
}

export async function deleteDomain(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/domains/${id}`);
}

export async function verifyDomain(id: string): Promise<EmailDomain> {
    const { data } = await apiClient.post(`${BASE}/domains/${id}/verify`);
    return data;
}
