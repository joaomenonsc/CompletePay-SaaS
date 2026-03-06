"use client";

import { useEffect, useRef } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api-config";
import { removePersistedPendingMessage } from "@/lib/whatsapp-pending-store";
import {
    applyIncomingMessageToConversationCache,
    getConversationFromCache,
    replaceConversationInCache,
} from "@/lib/whatsapp-query-cache";
import type {
    WAAccountListResponse,
    WAConversation,
    WAMessage,
    WAMessageListResponse,
    WAMessageStatus,
} from "@/types/whatsapp";
import { useAuthStore } from "@/store/auth-store";

/** Converte http(s):// → ws(s):// */
function toWsUrl(accountId: string): string {
    const base = API_BASE_URL.replace(/^http/, "ws");
    return `${base}/api/v1/whatsapp/ws/${accountId}`;
}

export type WsStatus = "connecting" | "connected" | "disconnected";

interface UseInboxWsOptions {
    accountId: string | null;
    onStatusChange?: (status: WsStatus) => void;
}

type MessageUpdateEventItem = {
    external_message_id?: string;
    status?: string;
    error?: string | null;
};

function normalizeMessageStatus(value: unknown): WAMessageStatus | null {
    const normalized = String(value || "").trim().toLowerCase();
    if (
        normalized === "pending"
        || normalized === "sent"
        || normalized === "delivered"
        || normalized === "read"
        || normalized === "failed"
    ) {
        return normalized;
    }
    return null;
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

function appendMessageToThreadCache(
    value: unknown,
    message: WAMessage
): unknown {
    if (!value) {
        return {
            items: [message],
            total: 1,
            limit: 100,
            offset: 0,
        } satisfies WAMessageListResponse;
    }

    if (isMessageListResponse(value)) {
        const exists = value.items.some((item) => item.id === message.id);
        if (exists) return value;
        return {
            ...value,
            items: [...value.items, message],
            total: value.total + 1,
        };
    }

    if (isInfiniteMessageListResponse(value)) {
        const exists = value.pages.some((page) => (
            page.items.some((item) => item.id === message.id)
        ));
        if (exists) return value;

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

    return value;
}

function patchMessageStatuses(
    value: unknown,
    updates: MessageUpdateEventItem[]
): unknown {
    const applyToItems = (items: WAMessage[]) => {
        let changed = false;
        const nextItems = items.map((message) => {
            const match = updates.find(
                (item) =>
                    item.external_message_id
                    && item.external_message_id === message.external_message_id
            );
            if (!match) return message;
            const nextStatus = normalizeMessageStatus(match.status);
            if (!nextStatus) return message;
            changed = true;
            return {
                ...message,
                status: nextStatus,
                error_message: match.error || undefined,
            };
        });
        return { changed, nextItems };
    };

    if (isMessageListResponse(value)) {
        const { changed, nextItems } = applyToItems(value.items);
        return changed ? { ...value, items: nextItems } : value;
    }

    if (isInfiniteMessageListResponse(value)) {
        let changed = false;
        const nextPages = value.pages.map((page) => {
            const result = applyToItems(page.items);
            if (result.changed) changed = true;
            return result.changed ? { ...page, items: result.nextItems } : page;
        });
        return changed ? { ...value, pages: nextPages } : value;
    }

    return value;
}

/**
 * Conecta ao WebSocket do backend para receber eventos do Inbox em tempo real.
 * Usa refs para o callback e para a lógica de conexão, evitando re-renders em loop.
 */
export function useInboxWebSocket({ accountId, onStatusChange }: UseInboxWsOptions) {
    const qc = useQueryClient();

    // Refs estáveis — não causam re-render nem re-execução de efeitos
    const wsRef = useRef<WebSocket | null>(null);
    const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const backoffRef = useRef(2000);
    const mountedRef = useRef(false);
    // Guardar o callback mais recente sem colocar nas dependências do useEffect
    const onStatusRef = useRef(onStatusChange);
    onStatusRef.current = onStatusChange;

    const qcRef = useRef(qc);
    qcRef.current = qc;

    useEffect(() => {
        if (!accountId) return;
        // Narrows accountId para string dentro do closure
        const id: string = accountId;

        mountedRef.current = true;
        backoffRef.current = 2000;

        function notify(s: WsStatus) {
            onStatusRef.current?.(s);
        }

        function handleEvent(event: Record<string, unknown>) {
            const type = event.type as string;
            const client = qcRef.current;

            switch (type) {
                case "message.new": {
                    const convId = event.conversation_id as string | null;
                    const msg = event.message as WAMessage;
                    const eventConversation = (
                        event.conversation && typeof event.conversation === "object"
                    )
                        ? event.conversation as WAConversation
                        : null;
                    if (!convId) break;
                    if (typeof msg.client_pending_id === "string" && msg.client_pending_id.trim()) {
                        removePersistedPendingMessage(msg.client_pending_id);
                    }
                    client.setQueriesData(
                        { queryKey: ["wa-messages", convId] },
                        (old) => appendMessageToThreadCache(old, msg)
                    );
                    if (eventConversation?.id) {
                        replaceConversationInCache(
                            client,
                            eventConversation,
                            getConversationFromCache(client, eventConversation.id)
                        );
                    }
                    applyIncomingMessageToConversationCache(client, convId, {
                        direction: String(msg.direction || "inbound") as "inbound" | "outbound",
                        body_text: typeof msg.body_text === "string" ? msg.body_text : undefined,
                        message_type: String(msg.message_type || "text"),
                        created_at: typeof msg.created_at === "string" ? msg.created_at : "",
                    });
                    break;
                }
                case "message.update":
                    {
                        const updatesRaw = Array.isArray(event.data) ? event.data : [];
                        const updates = updatesRaw.filter(
                            (item): item is MessageUpdateEventItem =>
                                !!item && typeof item === "object"
                        );
                        if (updates.length === 0) break;

                        client.setQueriesData<WAMessageListResponse>(
                            { queryKey: ["wa-messages"] },
                            (old) => patchMessageStatuses(old, updates) as WAMessageListResponse
                        );
                    }
                    break;
                case "connection.update":
                    {
                        const nextStatus = String(event.status || "").trim();
                        if (!nextStatus) break;
                        client.setQueriesData<WAAccountListResponse>(
                            { queryKey: ["wa-accounts"] },
                            (old) => {
                                if (!old?.items?.length) return old;
                                let changed = false;
                                const nextItems = old.items.map((account) => {
                                    if (account.id !== id || account.status === nextStatus) {
                                        return account;
                                    }
                                    changed = true;
                                    return {
                                        ...account,
                                        status: nextStatus as WAAccountListResponse["items"][number]["status"],
                                    };
                                });
                                return changed ? { ...old, items: nextItems } : old;
                            }
                        );
                    }
                    break;
                default:
                    break;
            }
        }

        function connect() {
            if (!mountedRef.current) return;

            const token = useAuthStore.getState().token ?? "";
            const url = `${toWsUrl(id)}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

            notify("connecting");
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                backoffRef.current = 2000;
                notify("connected");
                const ping = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) ws.send("ping");
                }, 25_000);
                ws.addEventListener("close", () => clearInterval(ping));
            };

            ws.onmessage = (ev) => {
                try {
                    handleEvent(JSON.parse(ev.data as string));
                } catch {
                    // pong ou texto simples, ignorar
                }
            };

            ws.onclose = () => {
                notify("disconnected");
                if (!mountedRef.current) return;
                const delay = backoffRef.current;
                backoffRef.current = Math.min(delay * 2, 60_000);
                retryRef.current = setTimeout(connect, delay);
            };

            ws.onerror = () => ws.close();
        }

        connect();

        return () => {
            mountedRef.current = false;
            if (retryRef.current) clearTimeout(retryRef.current);
            wsRef.current?.close();
        };
        // Só re-conectar se o accountId mudar — callbacks via refs são estáveis
    }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps
}
