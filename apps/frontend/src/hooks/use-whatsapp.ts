"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    approveTemplate,
    createAccount,
    createCampaign,
    createTemplate,
    createTrigger,
    deleteAccount,
    deleteTemplate,
    deleteTrigger,
    fetchAccount,
    fetchAccounts,
    fetchCampaign,
    fetchCampaignProgress,
    fetchCampaigns,
    fetchConversation,
    fetchConversations,
    fetchMessages,
    fetchMetricsOverview,
    fetchQRCode,
    fetchSuggestReply,
    fetchSummarize,
    fetchTemplate,
    fetchTemplates,
    fetchTriggers,
    pauseCampaign,
    previewRecipients,
    rotateWebhookSecret,
    sendTemplateMessage,
    sendTextMessage,
    startCampaign,
    submitTemplate,
    syncAccountStatus,
    updateAccount,
    updateConversation,
    updateTemplate,
} from "@/lib/api/whatsapp";
import type {
    WAAccountCreate,
    WAAccountUpdate,
    WACampaignCreate,
    WAConversationUpdate,
    WASendTemplateInput,
    WASendTextInput,
    WATemplateCreate,
    WATemplateUpdate,
    WATriggerCreate,
} from "@/types/whatsapp";

// ── Query keys ─────────────────────────────────────────────────────────────────

const ACCOUNTS_KEY = ["wa-accounts"] as const;
const CONVERSATIONS_KEY = ["wa-conversations"] as const;
const MESSAGES_KEY = ["wa-messages"] as const;
const TEMPLATES_KEY = ["wa-templates"] as const;
const CAMPAIGNS_KEY = ["wa-campaigns"] as const;
const TRIGGERS_KEY = ["wa-triggers"] as const;
const METRICS_KEY = ["wa-metrics"] as const;

// ── Accounts ──────────────────────────────────────────────────────────────────

export function useAccounts(params?: { limit?: number; offset?: number }) {
    return useQuery({
        queryKey: [...ACCOUNTS_KEY, params ?? {}],
        queryFn: () => fetchAccounts(params),
        // Polling automático enquanto alguma conta não estiver conectada
        refetchInterval: (query) => {
            const items = query.state.data?.items ?? [];
            const hasDisconnected = items.some((a) => a.status !== "connected");
            return hasDisconnected ? 10_000 : false;
        },
    });
}

export function useAccount(id: string | null) {
    return useQuery({
        queryKey: [...ACCOUNTS_KEY, id],
        queryFn: () => fetchAccount(id!),
        enabled: !!id,
    });
}

export function useCreateAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: WAAccountCreate) => createAccount(body),
        onSuccess: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
    });
}

export function useUpdateAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: WAAccountUpdate }) =>
            updateAccount(id, body),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
            qc.invalidateQueries({ queryKey: [...ACCOUNTS_KEY, id] });
        },
    });
}

export function useDeleteAccount() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteAccount(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
    });
}

export function useSyncStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (accountId: string) => syncAccountStatus(accountId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
    });
}

export function useQRCode(accountId: string | null, enabled = false) {
    return useQuery({
        queryKey: [...ACCOUNTS_KEY, accountId, "qrcode"],
        queryFn: () => fetchQRCode(accountId!),
        enabled: !!accountId && enabled,
        refetchInterval: (query) => {
            // Poll a cada 5s enquanto QR não estiver disponível
            const data = query.state.data;
            return data?.status === "pending" ? 5000 : false;
        },
    });
}

export function useRotateWebhookSecret() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            accountId,
            webhookSecret,
        }: {
            accountId: string;
            webhookSecret: string;
        }) => rotateWebhookSecret(accountId, webhookSecret),
        onSuccess: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
    });
}

// ── Conversations ─────────────────────────────────────────────────────────────

export function useConversations(params?: {
    status?: string;
    assigned_to?: string;
    account_id?: string;
    limit?: number;
    offset?: number;
}) {
    return useQuery({
        queryKey: [...CONVERSATIONS_KEY, params ?? {}],
        queryFn: () => fetchConversations(params),
        refetchInterval: 5_000, // Polling a cada 5s (fallback quando WS não está disponível)
    });
}

export function useConversation(id: string | null) {
    return useQuery({
        queryKey: [...CONVERSATIONS_KEY, id],
        queryFn: () => fetchConversation(id!),
        enabled: !!id,
    });
}

export function useUpdateConversation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            body,
        }: {
            id: string;
            body: WAConversationUpdate;
        }) => updateConversation(id, body),
        onSuccess: (_, { id }) => {
            qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
            qc.invalidateQueries({ queryKey: [...CONVERSATIONS_KEY, id] });
        },
    });
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function useMessages(
    conversationId: string | null,
    params?: { limit?: number; offset?: number }
) {
    return useQuery({
        queryKey: [...MESSAGES_KEY, conversationId, params ?? {}],
        queryFn: () => fetchMessages(conversationId!, params),
        enabled: !!conversationId,
        refetchInterval: 5_000, // Polling a cada 5s para atualizações em tempo quase real
    });
}

export function useSendText(conversationId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: WASendTextInput) =>
            sendTextMessage(conversationId, body),
        onSuccess: () => {
            qc.invalidateQueries({
                queryKey: [...MESSAGES_KEY, conversationId],
            });
            qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        },
    });
}

export function useSendTemplate(conversationId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: WASendTemplateInput) =>
            sendTemplateMessage(conversationId, body),
        onSuccess: () => {
            qc.invalidateQueries({
                queryKey: [...MESSAGES_KEY, conversationId],
            });
            qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
        },
    });
}

// ── Templates ─────────────────────────────────────────────────────────────────

export function useTemplates(params?: {
    status?: string;
    account_id?: string;
    limit?: number;
    offset?: number;
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
        mutationFn: (body: WATemplateCreate) => createTemplate(body),
        onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
    });
}

export function useUpdateTemplate() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            body,
        }: {
            id: string;
            body: WATemplateUpdate;
        }) => updateTemplate(id, body),
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

export function useSubmitTemplate() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => submitTemplate(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
    });
}

export function useApproveTemplate() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => approveTemplate(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
    });
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export function useCampaigns(params?: {
    status?: string;
    limit?: number;
    offset?: number;
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
        mutationFn: (body: WACampaignCreate) => createCampaign(body),
        onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
    });
}

export function useStartCampaign() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => startCampaign(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
    });
}

export function usePauseCampaign() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => pauseCampaign(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
    });
}

export function useCampaignProgress(id: string | null, enabled?: boolean) {
    return useQuery({
        queryKey: [...CAMPAIGNS_KEY, id, "progress"],
        queryFn: () => fetchCampaignProgress(id!),
        enabled: !!id && (enabled ?? true),
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            // Poll a cada 5s enquanto rodando
            return status === "running" ? 5_000 : false;
        },
    });
}

export function usePreviewRecipients(tags?: string) {
    return useQuery({
        queryKey: ["wa-preview-recipients", tags],
        queryFn: () => previewRecipients(tags ? { tags } : undefined),
        enabled: true,
    });
}

// ── Triggers ──────────────────────────────────────────────────────────────────

export function useTriggers(params?: {
    account_id?: string;
    limit?: number;
    offset?: number;
}) {
    return useQuery({
        queryKey: [...TRIGGERS_KEY, params ?? {}],
        queryFn: () => fetchTriggers(params),
    });
}

export function useCreateTrigger() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: WATriggerCreate) => createTrigger(body),
        onSuccess: () => qc.invalidateQueries({ queryKey: TRIGGERS_KEY }),
    });
}

export function useDeleteTrigger() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteTrigger(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: TRIGGERS_KEY }),
    });
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export function useMetrics(period?: "1d" | "7d" | "30d" | "90d") {
    return useQuery({
        queryKey: [...METRICS_KEY, period ?? "7d"],
        queryFn: () => fetchMetricsOverview(period),
    });
}

// ── AI ────────────────────────────────────────────────────────────────────────

export function useSuggestReply(conversationId: string | null) {
    return useQuery({
        queryKey: ["wa-ai-suggest", conversationId],
        queryFn: () => fetchSuggestReply(conversationId!),
        enabled: !!conversationId,
        staleTime: 60_000, // 1 min de cache — não repetir AI desnecessariamente
    });
}

export function useSummarize(conversationId: string | null) {
    return useQuery({
        queryKey: ["wa-ai-summarize", conversationId],
        queryFn: () => fetchSummarize(conversationId!),
        enabled: !!conversationId,
        staleTime: 60_000,
    });
}
