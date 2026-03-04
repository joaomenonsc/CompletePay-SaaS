"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    cancelCampaign,
    createCampaign,
    createDomain,
    createList,
    createTemplate,
    deleteCampaign,
    deleteDomain,
    deleteTemplate,
    duplicateCampaign,
    fetchCampaign,
    fetchCampaignMetrics,
    fetchCampaigns,
    fetchDomain,
    fetchDomains,
    fetchList,
    fetchLists,
    fetchListSubscribers,
    fetchOverviewMetrics,
    fetchTemplate,
    fetchTemplates,
    scheduleCampaign,
    sendCampaign,
    updateCampaign,
    updateDomain,
    updateTemplate,
    sendTestEmail,
    verifyDomain,
} from "@/lib/api/marketing";
import type {
    CampaignCreateInput,
    CampaignUpdateInput,
    DomainCreateInput,
    DomainUpdateInput,
    EmailListCreateInput,
    EmailTemplateCreateInput,
    EmailTemplateUpdateInput,
} from "@/types/marketing";

// ── Query keys ─────────────────────────────────────────────────────────────────

const TEMPLATES_KEY = ["emk-templates"] as const;
const CAMPAIGNS_KEY = ["emk-campaigns"] as const;
const LISTS_KEY = ["emk-lists"] as const;
const METRICS_KEY = ["emk-metrics"] as const;
const DOMAINS_KEY = ["emk-domains"] as const;

// ── Templates ──────────────────────────────────────────────────────────────────

export function useTemplates(params?: {
    limit?: number;
    offset?: number;
    category?: string;
}) {
    return useQuery({
        queryKey: [...TEMPLATES_KEY, params ?? {}],
        queryFn: () => fetchTemplates(params),
    });
}

export function useTemplate(id: string | null) {
    return useQuery({
        queryKey: [...TEMPLATES_KEY, id],
        queryFn: () => fetchTemplate(id!),
        enabled: !!id,
    });
}

export function useCreateTemplate() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: EmailTemplateCreateInput) => createTemplate(body),
        onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
    });
}

export function useUpdateTemplate() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: EmailTemplateUpdateInput }) =>
            updateTemplate(id, body),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
            qc.invalidateQueries({ queryKey: [...TEMPLATES_KEY, id] });
        },
    });
}

export function useDeleteTemplate() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteTemplate(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
    });
}

// ── Campanhas ──────────────────────────────────────────────────────────────────

export function useCampaigns(params?: {
    limit?: number;
    offset?: number;
    status?: string;
}) {
    return useQuery({
        queryKey: [...CAMPAIGNS_KEY, params ?? {}],
        queryFn: () => fetchCampaigns(params),
    });
}

export function useCampaign(id: string | null) {
    return useQuery({
        queryKey: [...CAMPAIGNS_KEY, id],
        queryFn: () => fetchCampaign(id!),
        enabled: !!id,
    });
}

export function useCreateCampaign() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CampaignCreateInput) => createCampaign(body),
        onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
    });
}

export function useUpdateCampaign() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: CampaignUpdateInput }) =>
            updateCampaign(id, body),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
            qc.invalidateQueries({ queryKey: [...CAMPAIGNS_KEY, id] });
        },
    });
}

export function useSendCampaign() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => sendCampaign(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
    });
}

export function useCancelCampaign() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => cancelCampaign(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
    });
}

export function useDeleteCampaign() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteCampaign(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
    });
}

export function useDuplicateCampaign() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => duplicateCampaign(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
    });
}

export function useScheduleCampaign() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) =>
            scheduleCampaign(id, scheduledAt),
        onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
    });
}

// ── Listas ─────────────────────────────────────────────────────────────────────

export function useLists(params?: { limit?: number; offset?: number }) {
    return useQuery({
        queryKey: [...LISTS_KEY, params ?? {}],
        queryFn: () => fetchLists(params),
    });
}

export function useList(id: string | null) {
    return useQuery({
        queryKey: [...LISTS_KEY, id],
        queryFn: () => fetchList(id!),
        enabled: !!id,
    });
}

export function useListSubscribers(
    listId: string | null,
    params?: { limit?: number; offset?: number }
) {
    return useQuery({
        queryKey: [...LISTS_KEY, listId, "subscribers", params ?? {}],
        queryFn: () => fetchListSubscribers(listId!, params),
        enabled: !!listId,
    });
}

export function useCreateList() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: EmailListCreateInput) => createList(body),
        onSuccess: () => qc.invalidateQueries({ queryKey: LISTS_KEY }),
    });
}

// ── Métricas ───────────────────────────────────────────────────────────────────

export function useCampaignMetrics(campaignId: string | null) {
    return useQuery({
        queryKey: [...METRICS_KEY, campaignId],
        queryFn: () => fetchCampaignMetrics(campaignId!),
        enabled: !!campaignId,
    });
}

export function useOverviewMetrics() {
    return useQuery({
        queryKey: [...METRICS_KEY, "overview"],
        queryFn: () => fetchOverviewMetrics(),
    });
}

// ── Domínios ───────────────────────────────────────────────────────────────────

export function useDomains(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    region?: string;
    q?: string;
}) {
    return useQuery({
        queryKey: [...DOMAINS_KEY, params ?? {}],
        queryFn: () => fetchDomains(params),
    });
}

export function useDomain(id: string | null) {
    return useQuery({
        queryKey: [...DOMAINS_KEY, id],
        queryFn: () => fetchDomain(id!),
        enabled: !!id,
    });
}

export function useCreateDomain() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: DomainCreateInput) => createDomain(body),
        onSuccess: () => qc.invalidateQueries({ queryKey: DOMAINS_KEY }),
    });
}

export function useUpdateDomain() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: DomainUpdateInput }) =>
            updateDomain(id, body),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: DOMAINS_KEY });
            qc.invalidateQueries({ queryKey: [...DOMAINS_KEY, id] });
        },
    });
}

export function useDeleteDomain() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteDomain(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: DOMAINS_KEY }),
    });
}

export function useVerifyDomain() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => verifyDomain(id),
        onSuccess: (_, id) => {
            qc.invalidateQueries({ queryKey: DOMAINS_KEY });
            qc.invalidateQueries({ queryKey: [...DOMAINS_KEY, id] });
        },
    });
}

// ── Envio de teste ─────────────────────────────────────────────────────────────

export function useSendTestEmail() {
    return useMutation({
        mutationFn: (body: {
            to_email: string;
            subject: string;
            html_content: string;
            from_name?: string;
            from_email?: string;
        }) => sendTestEmail(body),
    });
}
