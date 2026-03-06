"use client";

import { useEffect, useMemo } from "react";
import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
    type InfiniteData,
} from "@tanstack/react-query";

import {
    approveTemplate,
    createAccount,
    createCampaign,
    createTemplate,
    createTrigger,
    deleteMessage,
    deleteAccount,
    deleteTemplate,
    deleteTrigger,
    editMessageText,
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
    sendMediaMessage,
    sendTemplateMessage,
    sendTextMessage,
    startCampaign,
    submitTemplate,
    syncAccountStatus,
    updateAccount,
    updateConversation,
    updateTemplate,
} from "@/lib/api/whatsapp";
import {
    getConversationFromCache,
    markConversationReadOptimistically,
    replaceConversationInCache,
} from "@/lib/whatsapp-query-cache";
import {
    buildClientPendingId,
    buildOptimisticMessageId,
    markPersistedPendingMessageFailed,
    mergePersistedPendingWithMessages,
    reconcilePersistedPendingMessages,
    removePersistedPendingMessage,
    upsertPersistedPendingMessage,
    usePersistedPendingMessages,
} from "@/lib/whatsapp-pending-store";
import { completeWhatsAppUxMetric } from "@/lib/whatsapp-ux-metrics";
import type {
    WAAccountCreate,
    WAAccountUpdate,
    WACampaignCreate,
    WAConversation,
    WAConversationListResponse,
    WAConversationUpdate,
    WAEditTextInput,
    WAMessage,
    WAMessageListResponse,
    WASendTemplateInput,
    WASendTextInput,
    WASendMediaInput,
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

type InternalUxTracking = {
    __uxActionId?: string;
};

function isConversationListResponse(value: unknown): value is WAConversationListResponse {
    if (!value || typeof value !== "object") return false;
    return Array.isArray((value as WAConversationListResponse).items);
}

function isMessageListResponse(value: unknown): value is WAMessageListResponse {
    if (!value || typeof value !== "object") return false;
    return Array.isArray((value as WAMessageListResponse).items);
}

function isInfiniteMessageListResponse(
    value: unknown
): value is InfiniteData<WAMessageListResponse, unknown> {
    if (!value || typeof value !== "object") return false;
    return Array.isArray((value as InfiniteData<WAMessageListResponse, unknown>).pages);
}

function getLatestMessageId(value: unknown): string | undefined {
    if (isMessageListResponse(value)) {
        return value.items.at(-1)?.id;
    }
    if (isInfiniteMessageListResponse(value)) {
        return value.pages[0]?.items.at(-1)?.id;
    }
    return undefined;
}

function appendMessageToCache(
    value: unknown,
    message: WAMessage
): WAMessageListResponse | InfiniteData<WAMessageListResponse, unknown> {
    if (!value) {
        return {
            items: [message],
            total: 1,
            limit: 100,
            offset: 0,
        };
    }

    if (isMessageListResponse(value)) {
        if (value.items.some((item) => item.id === message.id)) return value;
        return {
            ...value,
            items: [...value.items, message],
            total: value.total + 1,
        };
    }

    if (isInfiniteMessageListResponse(value)) {
        const alreadyExists = value.pages.some((page) => (
            page.items.some((item) => item.id === message.id)
        ));
        if (alreadyExists) return value;

        if (!value.pages.length) {
            return {
                ...value,
                pages: [{
                    items: [message],
                    total: 1,
                    limit: 100,
                    offset: 0,
                }],
            };
        }

        return {
            ...value,
            pages: value.pages.map((page, index) => ({
                ...page,
                items: index === 0 ? [...page.items, message] : page.items,
                total: page.total + 1,
            })),
        };
    }

    return {
        items: [message],
        total: 1,
        limit: 100,
        offset: 0,
    };
}

function patchMessageInCache(
    value: unknown,
    messageId: string,
    patcher: (message: WAMessage) => WAMessage
): unknown {
    if (isMessageListResponse(value)) {
        return {
            ...value,
            items: value.items.map((message) => (
                message.id === messageId ? patcher(message) : message
            )),
        };
    }

    if (isInfiniteMessageListResponse(value)) {
        return {
            ...value,
            pages: value.pages.map((page) => ({
                ...page,
                items: page.items.map((message) => (
                    message.id === messageId ? patcher(message) : message
                )),
            })),
        };
    }

    return value;
}

function reconcileMessageInCache(
    value: unknown,
    optimisticId: string | undefined,
    sentMessage: WAMessage
): unknown {
    const findOptimisticMessage = (items: WAMessage[]) => (
        optimisticId ? items.find((message) => message.id === optimisticId) : undefined
    );

    if (!value) {
        return {
            items: [sentMessage],
            total: 1,
            limit: 100,
            offset: 0,
        } satisfies WAMessageListResponse;
    }

    if (isMessageListResponse(value)) {
        const optimisticMessage = findOptimisticMessage(value.items);
        const fallbackMediaUrl = optimisticMessage?.media_url;
        const fallbackMediaType = optimisticMessage?.media_type;
        const fallbackMediaFilename = optimisticMessage?.media_filename;
        const withoutOptimistic = value.items.filter((message) => message.id !== optimisticId);
        const alreadyExists = withoutOptimistic.some((message) => message.id === sentMessage.id);
        const nextItems = alreadyExists
            ? withoutOptimistic.map((message) => (
                message.id !== sentMessage.id
                    ? message
                    : {
                        ...message,
                        ...sentMessage,
                        media_url: sentMessage.media_url || message.media_url || fallbackMediaUrl,
                        media_type: sentMessage.media_type || message.media_type || fallbackMediaType,
                        media_filename:
                            sentMessage.media_filename
                            || message.media_filename
                            || fallbackMediaFilename,
                    }
            ))
            : [
                ...withoutOptimistic,
                {
                    ...sentMessage,
                    media_url: sentMessage.media_url || fallbackMediaUrl,
                    media_type: sentMessage.media_type || fallbackMediaType,
                    media_filename: sentMessage.media_filename || fallbackMediaFilename,
                },
            ];

        return {
            ...value,
            items: nextItems,
            total: alreadyExists ? value.total : Math.max(value.total, nextItems.length),
        };
    }

    if (isInfiniteMessageListResponse(value)) {
        const optimisticMessage = value.pages
            .flatMap((page) => page.items)
            .find((message) => message.id === optimisticId);
        const fallbackMediaUrl = optimisticMessage?.media_url;
        const fallbackMediaType = optimisticMessage?.media_type;
        const fallbackMediaFilename = optimisticMessage?.media_filename;

        const pagesWithoutOptimistic = value.pages.map((page) => ({
            ...page,
            items: page.items.filter((message) => message.id !== optimisticId),
        }));

        const alreadyExists = pagesWithoutOptimistic.some((page) => (
            page.items.some((message) => message.id === sentMessage.id)
        ));

        const mergedSentMessage: WAMessage = {
            ...sentMessage,
            media_url: sentMessage.media_url || fallbackMediaUrl,
            media_type: sentMessage.media_type || fallbackMediaType,
            media_filename: sentMessage.media_filename || fallbackMediaFilename,
        };

        return {
            ...value,
            pages: pagesWithoutOptimistic.map((page, index) => ({
                ...page,
                items: alreadyExists
                    ? page.items.map((message) => (
                        message.id !== sentMessage.id
                            ? message
                            : {
                                ...message,
                                ...mergedSentMessage,
                            }
                    ))
                    : index === 0
                        ? [...page.items, mergedSentMessage]
                        : page.items,
            })),
        };
    }

    return value;
}

function mediaMessageTypeFromFile(file: File): "image" | "video" | "audio" | "document" {
    const mime = (file.type || "").toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "document";
}

function messagePreviewText(message: Pick<WAMessage, "body_text" | "message_type">): string {
    const text = (message.body_text || "").trim();
    if (text) return text.slice(0, 256);
    const type = (message.message_type || "text").toLowerCase();
    return `[${type}]`.slice(0, 256);
}

function ensureClientPendingId<T extends { client_pending_id?: string }>(payload: T): string {
    const current = (payload.client_pending_id || "").trim();
    if (current) {
        payload.client_pending_id = current;
        return current;
    }
    const next = buildClientPendingId();
    payload.client_pending_id = next;
    return next;
}

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
    refetchIntervalMs?: number;
}) {
    const { refetchIntervalMs, ...queryParams } = params ?? {};
    return useQuery({
        queryKey: [...CONVERSATIONS_KEY, queryParams],
        queryFn: () => fetchConversations(queryParams),
        refetchInterval: refetchIntervalMs || false,
    });
}

export function useConversation(
    id: string | null,
    options?: { refetchIntervalMs?: number }
) {
    const qc = useQueryClient();
    const query = useQuery({
        queryKey: [...CONVERSATIONS_KEY, id],
        queryFn: () => fetchConversation(id!),
        enabled: !!id,
        refetchInterval: options?.refetchIntervalMs || false,
    });

    useEffect(() => {
        if (!query.data) return;
        const previousConversation = getConversationFromCache(qc, query.data.id);
        replaceConversationInCache(qc, query.data, previousConversation);
        markConversationReadOptimistically(qc, query.data.id);
    }, [qc, query.data]);

    return query;
}

export function useUpdateConversation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            body,
        }: {
            id: string;
            body: WAConversationUpdate & InternalUxTracking;
        }) => {
            const { __uxActionId: _uxActionId, ...payload } = body;
            return updateConversation(id, payload);
        },
        onMutate: async ({ id, body }) => {
            await qc.cancelQueries({ queryKey: CONVERSATIONS_KEY });

            const previousConversationQueries = qc.getQueriesData<unknown>({
                queryKey: CONVERSATIONS_KEY,
            });
            const previousConversation = getConversationFromCache(qc, id);

            if (previousConversation) {
                const optimisticConversation: WAConversation = {
                    ...previousConversation,
                    status: body.status ?? previousConversation.status,
                    assigned_to:
                        body.assigned_to !== undefined
                            ? (body.assigned_to || undefined)
                            : previousConversation.assigned_to,
                    tags: body.tags ?? previousConversation.tags,
                    sla_deadline: body.sla_deadline ?? previousConversation.sla_deadline,
                };
                replaceConversationInCache(qc, optimisticConversation, previousConversation);
            }

            completeWhatsAppUxMetric(body.__uxActionId, {
                action: "update_conversation_status",
                conversation_id: id,
                feedback: "optimistic_cache",
                next_status: body.status,
            });

            return {
                previousConversationQueries,
                previousConversation,
            };
        },
        onSuccess: (conversation, { id }, context) => {
            replaceConversationInCache(
                qc,
                conversation,
                context?.previousConversation ?? getConversationFromCache(qc, id)
            );
        },
        onError: (_error, _variables, context) => {
            if (context?.previousConversationQueries) {
                for (const [queryKey, previous] of context.previousConversationQueries) {
                    qc.setQueryData(queryKey, previous);
                }
            }
        },
    });
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function useMessages(
    conversationId: string | null,
    params?: { limit?: number; offset?: number; refetchIntervalMs?: number }
) {
    const qc = useQueryClient();
    const persistedPending = usePersistedPendingMessages(conversationId);
    const { refetchIntervalMs, ...queryParams } = params ?? {};
    const query = useQuery({
        queryKey: [...MESSAGES_KEY, conversationId, queryParams],
        queryFn: () => fetchMessages(conversationId!, queryParams),
        enabled: !!conversationId,
        refetchInterval: refetchIntervalMs || false,
    });

    useEffect(() => {
        if (!query.data?.items?.length) return;
        reconcilePersistedPendingMessages(query.data.items);
    }, [query.data?.items]);

    useEffect(() => {
        if (!conversationId || !query.data) return;
        markConversationReadOptimistically(qc, conversationId);
    }, [conversationId, qc, query.data]);

    const mergedData = useMemo(
        () => mergePersistedPendingWithMessages(query.data, persistedPending, queryParams),
        [persistedPending, query.data, queryParams]
    );

    return {
        ...query,
        data: mergedData,
    };
}

export function useInfiniteMessages(
    conversationId: string | null,
    params?: { pageSize?: number; refetchIntervalMs?: number }
) {
    const qc = useQueryClient();
    const persistedPending = usePersistedPendingMessages(conversationId);
    const pageSize = params?.pageSize ?? 50;
    const refetchIntervalMs = params?.refetchIntervalMs;

    const query = useInfiniteQuery<WAMessageListResponse>({
        queryKey: [...MESSAGES_KEY, conversationId, { limit: pageSize, from_latest: true }],
        queryFn: ({ pageParam = 0 }) => fetchMessages(conversationId!, {
            limit: pageSize,
            offset: typeof pageParam === "number" ? pageParam : 0,
            from_latest: true,
        }),
        enabled: !!conversationId,
        initialPageParam: 0,
        getNextPageParam: (
            lastPage: WAMessageListResponse,
            allPages: WAMessageListResponse[]
        ) => {
            const loaded = allPages.reduce((sum: number, page: WAMessageListResponse) => (
                sum + page.items.length
            ), 0);
            return loaded < lastPage.total ? loaded : undefined;
        },
        refetchInterval: refetchIntervalMs || false,
    });

    const flattenedServerData = useMemo(() => {
        if (!query.data?.pages?.length) return undefined;
        const pages = [...query.data.pages].reverse();
        const items = pages.flatMap((page) => page.items);
        const latestPage = query.data.pages[0];
        return {
            items,
            total: latestPage?.total ?? items.length,
            limit: latestPage?.limit ?? pageSize,
            offset: 0,
        } satisfies WAMessageListResponse;
    }, [pageSize, query.data]);

    useEffect(() => {
        if (!flattenedServerData?.items?.length) return;
        reconcilePersistedPendingMessages(flattenedServerData.items);
    }, [flattenedServerData?.items]);

    useEffect(() => {
        if (!conversationId || !flattenedServerData) return;
        markConversationReadOptimistically(qc, conversationId);
    }, [conversationId, flattenedServerData, qc]);

    const mergedData = useMemo(
        () => mergePersistedPendingWithMessages(
            flattenedServerData,
            persistedPending,
            { limit: pageSize, offset: 0 }
        ),
        [flattenedServerData, pageSize, persistedPending]
    );

    return {
        ...query,
        data: mergedData,
    };
}

export function usePrefetchConversationThread(options?: { limit?: number }) {
    const qc = useQueryClient();
    const limit = options?.limit ?? 100;

    return (conversationId: string | null) => {
        if (!conversationId) return;
        void qc.prefetchQuery({
            queryKey: [...CONVERSATIONS_KEY, conversationId],
            queryFn: () => fetchConversation(conversationId),
            staleTime: 15_000,
        });
        void qc.prefetchInfiniteQuery<WAMessageListResponse>({
            queryKey: [...MESSAGES_KEY, conversationId, { limit, from_latest: true }],
            queryFn: ({ pageParam = 0 }) => fetchMessages(conversationId, {
                limit,
                offset: typeof pageParam === "number" ? pageParam : 0,
                from_latest: true,
            }),
            initialPageParam: 0,
            staleTime: 5_000,
            getNextPageParam: (
                lastPage: WAMessageListResponse,
                allPages: WAMessageListResponse[]
            ) => {
                const loaded = allPages.reduce((sum: number, page: WAMessageListResponse) => (
                    sum + page.items.length
                ), 0);
                return loaded < lastPage.total ? loaded : undefined;
            },
        });
        void qc.prefetchQuery({
            queryKey: [...MESSAGES_KEY, conversationId, { limit }],
            queryFn: () => fetchMessages(conversationId, { limit }),
            staleTime: 5_000,
        });
    };
}

export function useSendText(conversationId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: WASendTextInput & InternalUxTracking) => {
            ensureClientPendingId(body);
            const { __uxActionId: _uxActionId, ...payload } = body;
            return sendTextMessage(conversationId, payload);
        },
        onMutate: async (body) => {
            const text = (body.body_text || "").trim();
            if (!text) return null;
            const clientPendingId = ensureClientPendingId(body);

            await qc.cancelQueries({
                queryKey: [...MESSAGES_KEY, conversationId],
            });
            await qc.cancelQueries({ queryKey: CONVERSATIONS_KEY });

            const nowIso = new Date().toISOString();
            const optimisticId = buildOptimisticMessageId(clientPendingId);

            const optimisticMessage: WAMessage = {
                id: optimisticId,
                organization_id: "",
                conversation_id: conversationId,
                contact_id: "",
                external_message_id: clientPendingId,
                client_pending_id: clientPendingId,
                direction: "outbound",
                message_type: "text",
                status: "pending",
                body_text: text,
                created_at: nowIso,
            };

            upsertPersistedPendingMessage({
                ...optimisticMessage,
                media_type: undefined,
                media_filename: undefined,
            });

            const previousConversationQueries = qc.getQueriesData<unknown>({
                queryKey: CONVERSATIONS_KEY,
            });
            const previousConversation = qc.getQueryData<WAConversation>([
                ...CONVERSATIONS_KEY,
                conversationId,
            ]);

            qc.setQueriesData(
                { queryKey: [...MESSAGES_KEY, conversationId] },
                (old) => {
                    return appendMessageToCache(old, optimisticMessage);
                }
            );

            qc.setQueriesData(
                { queryKey: CONVERSATIONS_KEY },
                (old) => {
                    if (!isConversationListResponse(old)) return old;
                    return {
                        ...old,
                        items: old.items.map((conv) => {
                            if (conv.id !== conversationId) return conv;
                            return {
                                ...conv,
                                last_message_at: nowIso,
                                last_message_preview: text.slice(0, 256),
                            };
                        }),
                    };
                }
            );

            qc.setQueryData<WAConversation>(
                [...CONVERSATIONS_KEY, conversationId],
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        last_message_at: nowIso,
                        last_message_preview: text.slice(0, 256),
                    };
                }
            );

            completeWhatsAppUxMetric(body.__uxActionId, {
                action: "send_text",
                conversation_id: conversationId,
                feedback: "optimistic_message",
                message_type: "text",
            });

            return {
                optimisticId,
                clientPendingId,
                previousConversationQueries,
                previousConversation,
            };
        },
        onSuccess: (sentMessage, _variables, context) => {
            const optimisticId = context?.optimisticId;
            removePersistedPendingMessage(
                sentMessage.client_pending_id || context?.clientPendingId
            );
            qc.setQueriesData(
                { queryKey: [...MESSAGES_KEY, conversationId] },
                (old) => {
                    return reconcileMessageInCache(old, optimisticId, sentMessage);
                }
            );

            qc.setQueriesData(
                { queryKey: CONVERSATIONS_KEY },
                (old) => {
                    if (!isConversationListResponse(old)) return old;
                    return {
                        ...old,
                        items: old.items.map((conv) => {
                            if (conv.id !== conversationId) return conv;
                            return {
                                ...conv,
                                last_message_at: sentMessage.created_at,
                                last_message_preview: (sentMessage.body_text || "").slice(0, 256),
                            };
                        }),
                    };
                }
            );

            qc.setQueryData<WAConversation>(
                [...CONVERSATIONS_KEY, conversationId],
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        last_message_at: sentMessage.created_at,
                        last_message_preview: (sentMessage.body_text || "").slice(0, 256),
                    };
                }
            );
        },
        onError: (error, _variables, context) => {
            const errorText = error instanceof Error ? error.message : "Falha ao enviar mensagem.";
            if (context?.previousConversationQueries) {
                for (const [queryKey, previous] of context.previousConversationQueries) {
                    qc.setQueryData(queryKey, previous);
                }
            }
            if (context?.previousConversation) {
                qc.setQueryData(
                    [...CONVERSATIONS_KEY, conversationId],
                    context.previousConversation
                );
            }

            // Mantém feedback visual de falha no próprio histórico, sem esperar novo fetch.
            if (context?.optimisticId) {
                if (context.clientPendingId) {
                    markPersistedPendingMessageFailed(context.clientPendingId, errorText);
                }
                qc.setQueriesData(
                    { queryKey: [...MESSAGES_KEY, conversationId] },
                    (old) => {
                        return patchMessageInCache(old, context.optimisticId, (message) => ({
                            ...message,
                            status: "failed",
                            error_message: errorText,
                        }));
                    }
                );
            }
        },
    });
}

export function useSendTemplate(conversationId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: WASendTemplateInput & InternalUxTracking) => {
            ensureClientPendingId(body);
            const { __uxActionId: _uxActionId, ...payload } = body;
            return sendTemplateMessage(conversationId, payload);
        },
        onMutate: async (body) => {
            const clientPendingId = ensureClientPendingId(body);
            await qc.cancelQueries({
                queryKey: [...MESSAGES_KEY, conversationId],
            });
            await qc.cancelQueries({ queryKey: CONVERSATIONS_KEY });

            const nowIso = new Date().toISOString();
            const optimisticId = buildOptimisticMessageId(clientPendingId);
            const optimisticMessage: WAMessage = {
                id: optimisticId,
                organization_id: "",
                conversation_id: conversationId,
                contact_id: "",
                external_message_id: clientPendingId,
                client_pending_id: clientPendingId,
                direction: "outbound",
                message_type: "template",
                status: "pending",
                body_text: "[template]",
                created_at: nowIso,
            };

            upsertPersistedPendingMessage({
                ...optimisticMessage,
                media_type: undefined,
                media_filename: undefined,
            });

            const previousConversationQueries = qc.getQueriesData<unknown>({
                queryKey: CONVERSATIONS_KEY,
            });
            const previousConversation = qc.getQueryData<WAConversation>([
                ...CONVERSATIONS_KEY,
                conversationId,
            ]);

            qc.setQueriesData(
                { queryKey: [...MESSAGES_KEY, conversationId] },
                (old) => {
                    return appendMessageToCache(old, optimisticMessage);
                }
            );

            const preview = messagePreviewText(optimisticMessage);
            qc.setQueriesData(
                { queryKey: CONVERSATIONS_KEY },
                (old) => {
                    if (!isConversationListResponse(old)) return old;
                    return {
                        ...old,
                        items: old.items.map((conv) => {
                            if (conv.id !== conversationId) return conv;
                            return {
                                ...conv,
                                last_message_at: nowIso,
                                last_message_preview: preview,
                            };
                        }),
                    };
                }
            );
            qc.setQueryData<WAConversation>(
                [...CONVERSATIONS_KEY, conversationId],
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        last_message_at: nowIso,
                        last_message_preview: preview,
                    };
                }
            );

            completeWhatsAppUxMetric(body.__uxActionId, {
                action: "send_template",
                conversation_id: conversationId,
                feedback: "optimistic_message",
                message_type: "template",
            });

            return {
                optimisticId,
                clientPendingId,
                previousConversationQueries,
                previousConversation,
            };
        },
        onSuccess: (sentMessage, _variables, context) => {
            const optimisticId = context?.optimisticId;
            removePersistedPendingMessage(
                sentMessage.client_pending_id || context?.clientPendingId
            );
            qc.setQueriesData(
                { queryKey: [...MESSAGES_KEY, conversationId] },
                (old) => {
                    return reconcileMessageInCache(old, optimisticId, sentMessage);
                }
            );

            const preview = messagePreviewText(sentMessage);
            qc.setQueriesData(
                { queryKey: CONVERSATIONS_KEY },
                (old) => {
                    if (!isConversationListResponse(old)) return old;
                    return {
                        ...old,
                        items: old.items.map((conv) => {
                            if (conv.id !== conversationId) return conv;
                            return {
                                ...conv,
                                last_message_at: sentMessage.created_at,
                                last_message_preview: preview,
                            };
                        }),
                    };
                }
            );
            qc.setQueryData<WAConversation>(
                [...CONVERSATIONS_KEY, conversationId],
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        last_message_at: sentMessage.created_at,
                        last_message_preview: preview,
                    };
                }
            );
        },
        onError: (error, _variables, context) => {
            const errorText = error instanceof Error ? error.message : "Falha ao enviar template.";
            if (context?.previousConversationQueries) {
                for (const [queryKey, previous] of context.previousConversationQueries) {
                    qc.setQueryData(queryKey, previous);
                }
            }
            if (context?.previousConversation) {
                qc.setQueryData(
                    [...CONVERSATIONS_KEY, conversationId],
                    context.previousConversation
                );
            }
            if (context?.optimisticId) {
                if (context.clientPendingId) {
                    markPersistedPendingMessageFailed(context.clientPendingId, errorText);
                }
                qc.setQueriesData(
                    { queryKey: [...MESSAGES_KEY, conversationId] },
                    (old) => {
                        return patchMessageInCache(old, context.optimisticId, (message) => ({
                            ...message,
                            status: "failed",
                            error_message: errorText,
                        }));
                    }
                );
            }
        },
    });
}

export function useEditMessage(conversationId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            messageId,
            body,
        }: {
            messageId: string;
            body: WAEditTextInput & InternalUxTracking;
        }) => {
            const { __uxActionId: _uxActionId, ...payload } = body;
            return editMessageText(messageId, payload);
        },
        onMutate: async ({ messageId, body }) => {
            const nextText = (body.body_text || "").trim();
            if (!nextText) return null;

            await qc.cancelQueries({
                queryKey: [...MESSAGES_KEY, conversationId],
            });
            await qc.cancelQueries({ queryKey: CONVERSATIONS_KEY });

            const previousMessageQueries = qc.getQueriesData<unknown>({
                queryKey: [...MESSAGES_KEY, conversationId],
            });
            const previousConversationQueries = qc.getQueriesData<unknown>({
                queryKey: CONVERSATIONS_KEY,
            });
            const previousConversation = qc.getQueryData<WAConversation>([
                ...CONVERSATIONS_KEY,
                conversationId,
            ]);

            let shouldUpdatePreview = false;
            qc.setQueriesData(
                { queryKey: [...MESSAGES_KEY, conversationId] },
                (old) => {
                    if (getLatestMessageId(old) === messageId) {
                        shouldUpdatePreview = true;
                    }
                    return patchMessageInCache(old, messageId, (message) => ({
                        ...message,
                        body_text: nextText,
                    }));
                }
            );

            if (shouldUpdatePreview) {
                qc.setQueriesData(
                    { queryKey: CONVERSATIONS_KEY },
                    (old) => {
                        if (!isConversationListResponse(old)) return old;
                        return {
                            ...old,
                            items: old.items.map((conv) => {
                                if (conv.id !== conversationId) return conv;
                                return {
                                    ...conv,
                                    last_message_preview: nextText.slice(0, 256),
                                };
                            }),
                        };
                    }
                );
                qc.setQueryData<WAConversation>(
                    [...CONVERSATIONS_KEY, conversationId],
                    (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            last_message_preview: nextText.slice(0, 256),
                        };
                    }
                );
            }

            completeWhatsAppUxMetric(body.__uxActionId, {
                action: "edit_message",
                conversation_id: conversationId,
                message_id: messageId,
                feedback: "optimistic_cache",
            });

            return {
                previousMessageQueries,
                previousConversationQueries,
                previousConversation,
            };
        },
        onSuccess: (editedMessage) => {
            let shouldUpdatePreview = false;
            qc.setQueriesData(
                { queryKey: [...MESSAGES_KEY, conversationId] },
                (old) => {
                    if (getLatestMessageId(old) === editedMessage.id) {
                        shouldUpdatePreview = true;
                    }
                    return patchMessageInCache(old, editedMessage.id, (message) => ({
                        ...message,
                        ...editedMessage,
                    }));
                }
            );

            if (shouldUpdatePreview) {
                const preview = messagePreviewText(editedMessage);
                qc.setQueriesData(
                    { queryKey: CONVERSATIONS_KEY },
                    (old) => {
                        if (!isConversationListResponse(old)) return old;
                        return {
                            ...old,
                            items: old.items.map((conv) => {
                                if (conv.id !== conversationId) return conv;
                                return {
                                    ...conv,
                                    last_message_preview: preview,
                                };
                            }),
                        };
                    }
                );
                qc.setQueryData<WAConversation>(
                    [...CONVERSATIONS_KEY, conversationId],
                    (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            last_message_preview: preview,
                        };
                    }
                );
            }
        },
        onError: (_error, _variables, context) => {
            if (context?.previousMessageQueries) {
                for (const [queryKey, previous] of context.previousMessageQueries) {
                    qc.setQueryData(queryKey, previous);
                }
            }
            if (context?.previousConversationQueries) {
                for (const [queryKey, previous] of context.previousConversationQueries) {
                    qc.setQueryData(queryKey, previous);
                }
            }
            if (context?.previousConversation) {
                qc.setQueryData(
                    [...CONVERSATIONS_KEY, conversationId],
                    context.previousConversation
                );
            }
        },
    });
}

export function useDeleteMessage(conversationId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            messageId,
        }: {
            messageId: string;
            __uxActionId?: string;
        }) => deleteMessage(messageId),
        onMutate: async ({ messageId, __uxActionId }) => {
            await qc.cancelQueries({
                queryKey: [...MESSAGES_KEY, conversationId],
            });
            await qc.cancelQueries({ queryKey: CONVERSATIONS_KEY });

            const previousMessageQueries = qc.getQueriesData<unknown>({
                queryKey: [...MESSAGES_KEY, conversationId],
            });
            const previousConversationQueries = qc.getQueriesData<unknown>({
                queryKey: CONVERSATIONS_KEY,
            });
            const previousConversation = qc.getQueryData<WAConversation>([
                ...CONVERSATIONS_KEY,
                conversationId,
            ]);

            const deletedPlaceholder = "Você apagou esta mensagem.";
            let shouldUpdatePreview = false;
            qc.setQueriesData(
                { queryKey: [...MESSAGES_KEY, conversationId] },
                (old) => {
                    if (getLatestMessageId(old) === messageId) {
                        shouldUpdatePreview = true;
                    }
                    return patchMessageInCache(old, messageId, (message) => ({
                        ...message,
                        body_text: deletedPlaceholder,
                        message_type: "text",
                        media_url: undefined,
                        media_type: undefined,
                        media_filename: undefined,
                    }));
                }
            );

            if (shouldUpdatePreview) {
                qc.setQueriesData(
                    { queryKey: CONVERSATIONS_KEY },
                    (old) => {
                        if (!isConversationListResponse(old)) return old;
                        return {
                            ...old,
                            items: old.items.map((conv) => {
                                if (conv.id !== conversationId) return conv;
                                return {
                                    ...conv,
                                    last_message_preview: deletedPlaceholder,
                                };
                            }),
                        };
                    }
                );
                qc.setQueryData<WAConversation>(
                    [...CONVERSATIONS_KEY, conversationId],
                    (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            last_message_preview: deletedPlaceholder,
                        };
                    }
                );
            }

            completeWhatsAppUxMetric(__uxActionId, {
                action: "delete_message",
                conversation_id: conversationId,
                message_id: messageId,
                feedback: "optimistic_cache",
            });

            return {
                previousMessageQueries,
                previousConversationQueries,
                previousConversation,
            };
        },
        onSuccess: (deletedMessage) => {
            const deletedPlaceholder = "Você apagou esta mensagem.";
            let shouldUpdatePreview = false;
            qc.setQueriesData(
                { queryKey: [...MESSAGES_KEY, conversationId] },
                (old) => {
                    if (getLatestMessageId(old) === deletedMessage.id) {
                        shouldUpdatePreview = true;
                    }
                    return patchMessageInCache(old, deletedMessage.id, (message) => ({
                        ...message,
                        ...deletedMessage,
                        body_text: deletedMessage.body_text || deletedPlaceholder,
                        message_type: "text",
                        media_url: undefined,
                        media_type: undefined,
                        media_filename: undefined,
                    }));
                }
            );

            if (shouldUpdatePreview) {
                const preview = messagePreviewText(deletedMessage);
                qc.setQueriesData(
                    { queryKey: CONVERSATIONS_KEY },
                    (old) => {
                        if (!isConversationListResponse(old)) return old;
                        return {
                            ...old,
                            items: old.items.map((conv) => {
                                if (conv.id !== conversationId) return conv;
                                return {
                                    ...conv,
                                    last_message_preview: preview,
                                };
                            }),
                        };
                    }
                );
                qc.setQueryData<WAConversation>(
                    [...CONVERSATIONS_KEY, conversationId],
                    (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            last_message_preview: preview,
                        };
                    }
                );
            }
        },
        onError: (_error, _variables, context) => {
            if (context?.previousMessageQueries) {
                for (const [queryKey, previous] of context.previousMessageQueries) {
                    qc.setQueryData(queryKey, previous);
                }
            }
            if (context?.previousConversationQueries) {
                for (const [queryKey, previous] of context.previousConversationQueries) {
                    qc.setQueryData(queryKey, previous);
                }
            }
            if (context?.previousConversation) {
                qc.setQueryData(
                    [...CONVERSATIONS_KEY, conversationId],
                    context.previousConversation
                );
            }
        },
    });
}

export function useSendMedia(conversationId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: WASendMediaInput & InternalUxTracking) => {
            ensureClientPendingId(body);
            const { __uxActionId: _uxActionId, ...payload } = body;
            return sendMediaMessage(conversationId, payload);
        },
        onMutate: async (body) => {
            const clientPendingId = ensureClientPendingId(body);
            await qc.cancelQueries({
                queryKey: [...MESSAGES_KEY, conversationId],
            });
            await qc.cancelQueries({ queryKey: CONVERSATIONS_KEY });

            const caption = (body.caption || "").trim();
            const messageType = mediaMessageTypeFromFile(body.file);
            const nowIso = new Date().toISOString();
            const optimisticId = buildOptimisticMessageId(clientPendingId);
            const optimisticMessage: WAMessage = {
                id: optimisticId,
                organization_id: "",
                conversation_id: conversationId,
                contact_id: "",
                external_message_id: clientPendingId,
                client_pending_id: clientPendingId,
                direction: "outbound",
                message_type: messageType,
                status: "pending",
                body_text: caption || undefined,
                media_url: URL.createObjectURL(body.file),
                media_type: body.file.type || undefined,
                media_filename: body.file.name || undefined,
                created_at: nowIso,
            };

            upsertPersistedPendingMessage({
                id: optimisticMessage.id,
                conversation_id: conversationId,
                external_message_id: clientPendingId,
                client_pending_id: clientPendingId,
                direction: "outbound",
                message_type: messageType,
                status: "pending",
                body_text: caption || undefined,
                media_type: body.file.type || undefined,
                media_filename: body.file.name || undefined,
                created_at: nowIso,
            });

            const previousConversationQueries = qc.getQueriesData<unknown>({
                queryKey: CONVERSATIONS_KEY,
            });
            const previousConversation = qc.getQueryData<WAConversation>([
                ...CONVERSATIONS_KEY,
                conversationId,
            ]);

            qc.setQueriesData(
                { queryKey: [...MESSAGES_KEY, conversationId] },
                (old) => {
                    return appendMessageToCache(old, optimisticMessage);
                }
            );

            const preview = messagePreviewText(optimisticMessage);
            qc.setQueriesData(
                { queryKey: CONVERSATIONS_KEY },
                (old) => {
                    if (!isConversationListResponse(old)) return old;
                    return {
                        ...old,
                        items: old.items.map((conv) => {
                            if (conv.id !== conversationId) return conv;
                            return {
                                ...conv,
                                last_message_at: nowIso,
                                last_message_preview: preview,
                            };
                        }),
                    };
                }
            );
            qc.setQueryData<WAConversation>(
                [...CONVERSATIONS_KEY, conversationId],
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        last_message_at: nowIso,
                        last_message_preview: preview,
                    };
                }
            );

            completeWhatsAppUxMetric(body.__uxActionId, {
                action: "send_media",
                conversation_id: conversationId,
                feedback: "optimistic_message",
                message_type: messageType,
            });

            return {
                optimisticId,
                clientPendingId,
                previousConversationQueries,
                previousConversation,
            };
        },
        onSuccess: (sentMessage, _variables, context) => {
            const optimisticId = context?.optimisticId;
            removePersistedPendingMessage(
                sentMessage.client_pending_id || context?.clientPendingId
            );
            qc.setQueriesData(
                { queryKey: [...MESSAGES_KEY, conversationId] },
                (old) => {
                    return reconcileMessageInCache(old, optimisticId, sentMessage);
                }
            );

            const preview = messagePreviewText(sentMessage);
            qc.setQueriesData(
                { queryKey: CONVERSATIONS_KEY },
                (old) => {
                    if (!isConversationListResponse(old)) return old;
                    return {
                        ...old,
                        items: old.items.map((conv) => {
                            if (conv.id !== conversationId) return conv;
                            return {
                                ...conv,
                                last_message_at: sentMessage.created_at,
                                last_message_preview: preview,
                            };
                        }),
                    };
                }
            );
            qc.setQueryData<WAConversation>(
                [...CONVERSATIONS_KEY, conversationId],
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        last_message_at: sentMessage.created_at,
                        last_message_preview: preview,
                    };
                }
            );
        },
        onError: (error, _variables, context) => {
            const errorText = error instanceof Error ? error.message : "Falha ao enviar arquivo.";
            if (context?.previousConversationQueries) {
                for (const [queryKey, previous] of context.previousConversationQueries) {
                    qc.setQueryData(queryKey, previous);
                }
            }
            if (context?.previousConversation) {
                qc.setQueryData(
                    [...CONVERSATIONS_KEY, conversationId],
                    context.previousConversation
                );
            }
            if (context?.optimisticId) {
                if (context.clientPendingId) {
                    markPersistedPendingMessageFailed(context.clientPendingId, errorText);
                }
                qc.setQueriesData(
                    { queryKey: [...MESSAGES_KEY, conversationId] },
                    (old) => {
                        return patchMessageInCache(old, context.optimisticId, (message) => ({
                            ...message,
                            status: "failed",
                            error_message: errorText,
                        }));
                    }
                );
            }
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

export function useMetrics(
    period?: "1d" | "7d" | "30d" | "90d",
    options?: { refetchIntervalMs?: number }
) {
    return useQuery({
        queryKey: [...METRICS_KEY, period ?? "7d"],
        queryFn: () => fetchMetricsOverview(period),
        refetchInterval: options?.refetchIntervalMs || false,
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
