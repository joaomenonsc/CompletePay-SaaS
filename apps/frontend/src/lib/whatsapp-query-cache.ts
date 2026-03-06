"use client";

import type { QueryClient } from "@tanstack/react-query";

import type { WAConversation, WAConversationListResponse, WAMessage } from "@/types/whatsapp";

export const WHATSAPP_CONVERSATIONS_QUERY_KEY = ["wa-conversations"] as const;
export const WHATSAPP_MESSAGES_QUERY_KEY = ["wa-messages"] as const;

type ConversationQueryParams = {
    status?: string;
    assigned_to?: string;
    account_id?: string;
    limit?: number;
    offset?: number;
};

function isConversationListResponse(value: unknown): value is WAConversationListResponse {
    if (!value || typeof value !== "object") return false;
    return Array.isArray((value as WAConversationListResponse).items);
}

function isConversationResponse(value: unknown): value is WAConversation {
    if (!value || typeof value !== "object") return false;
    return typeof (value as WAConversation).id === "string";
}

function getConversationQueryParams(queryKey: readonly unknown[]): ConversationQueryParams {
    const params = queryKey[1];
    if (!params || typeof params !== "object") {
        return {};
    }
    return params as ConversationQueryParams;
}

function matchesConversationFilters(
    conversation: WAConversation,
    params: ConversationQueryParams
): boolean {
    if (params.status && conversation.status !== params.status) return false;
    if (params.account_id && conversation.account_id !== params.account_id) return false;
    if (params.assigned_to && (conversation.assigned_to || "") !== params.assigned_to) return false;
    return true;
}

function conversationSortValue(conversation: WAConversation): number {
    const candidate = conversation.last_message_at || conversation.created_at;
    const timestamp = candidate ? new Date(candidate).getTime() : 0;
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortConversations(items: WAConversation[]): WAConversation[] {
    return [...items].sort((left, right) => {
        const diff = conversationSortValue(right) - conversationSortValue(left);
        if (diff !== 0) return diff;
        return right.id.localeCompare(left.id);
    });
}

function buildMessagePreview(message: Pick<WAMessage, "body_text" | "message_type">): string {
    const text = (message.body_text || "").trim();
    if (text) return text.slice(0, 256);
    const type = (message.message_type || "text").toLowerCase();
    return `[${type}]`.slice(0, 256);
}

export function getConversationFromCache(
    client: QueryClient,
    conversationId: string
): WAConversation | null {
    const direct = client.getQueryData<unknown>([
        ...WHATSAPP_CONVERSATIONS_QUERY_KEY,
        conversationId,
    ]);
    if (isConversationResponse(direct)) {
        return direct;
    }

    const queries = client.getQueriesData<unknown>({
        queryKey: WHATSAPP_CONVERSATIONS_QUERY_KEY,
    });
    for (const [, data] of queries) {
        if (!isConversationListResponse(data)) continue;
        const found = data.items.find((conversation) => conversation.id === conversationId);
        if (found) return found;
    }

    return null;
}

export function replaceConversationInCache(
    client: QueryClient,
    nextConversation: WAConversation,
    previousConversation?: WAConversation | null
): void {
    const queries = client.getQueriesData<unknown>({
        queryKey: WHATSAPP_CONVERSATIONS_QUERY_KEY,
    });

    for (const [queryKey, data] of queries) {
        if (!Array.isArray(queryKey)) continue;

        if (
            queryKey.length >= 2
            && queryKey[0] === WHATSAPP_CONVERSATIONS_QUERY_KEY[0]
            && queryKey[1] === nextConversation.id
        ) {
            client.setQueryData(queryKey, nextConversation);
            continue;
        }

        if (!isConversationListResponse(data)) continue;

        const params = getConversationQueryParams(queryKey);
        const existsIndex = data.items.findIndex(
            (conversation) => conversation.id === nextConversation.id
        );
        const previousMatch = previousConversation
            ? matchesConversationFilters(previousConversation, params)
            : existsIndex >= 0;
        const nextMatch = matchesConversationFilters(nextConversation, params);

        let nextItems = data.items;
        let nextTotal = data.total;

        if (existsIndex >= 0 && nextMatch) {
            nextItems = sortConversations(
                data.items.map((conversation) =>
                    conversation.id === nextConversation.id ? nextConversation : conversation
                )
            );
        } else if (existsIndex >= 0 && !nextMatch) {
            nextItems = data.items.filter(
                (conversation) => conversation.id !== nextConversation.id
            );
            if (previousMatch) {
                nextTotal = Math.max(0, data.total - 1);
            }
        } else if (existsIndex < 0 && nextMatch) {
            if (!params.offset || params.offset === 0) {
                nextItems = sortConversations([nextConversation, ...data.items]);
                if (params.limit && nextItems.length > params.limit) {
                    nextItems = nextItems.slice(0, params.limit);
                }
            }
            if (!previousMatch) {
                nextTotal = data.total + 1;
            }
        } else {
            continue;
        }

        client.setQueryData<WAConversationListResponse>(queryKey, {
            ...data,
            items: nextItems,
            total: nextTotal,
        });
    }
}

export function patchConversationInCache(
    client: QueryClient,
    conversationId: string,
    patcher: (conversation: WAConversation) => WAConversation
): void {
    const previousConversation = getConversationFromCache(client, conversationId);
    if (!previousConversation) return;
    const nextConversation = patcher(previousConversation);
    replaceConversationInCache(client, nextConversation, previousConversation);
}

export function markConversationReadOptimistically(
    client: QueryClient,
    conversationId: string
): void {
    const previousConversation = getConversationFromCache(client, conversationId);
    if (!previousConversation || (previousConversation.unread_count || 0) === 0) {
        return;
    }

    replaceConversationInCache(client, {
        ...previousConversation,
        unread_count: 0,
    }, previousConversation);
}

function isConversationObserved(client: QueryClient, conversationId: string): boolean {
    const queryCache = client.getQueryCache();
    const watchedMessageQuery = queryCache.findAll({
        queryKey: [...WHATSAPP_MESSAGES_QUERY_KEY, conversationId],
    }).some((query) => query.getObserversCount() > 0);

    const watchedConversationQuery = queryCache.findAll({
        queryKey: [...WHATSAPP_CONVERSATIONS_QUERY_KEY, conversationId],
    }).some((query) => query.getObserversCount() > 0);

    return watchedMessageQuery || watchedConversationQuery;
}

export function applyIncomingMessageToConversationCache(
    client: QueryClient,
    conversationId: string,
    message: Pick<WAMessage, "direction" | "body_text" | "message_type" | "created_at">
): boolean {
    const previousConversation = getConversationFromCache(client, conversationId);
    if (!previousConversation) return false;

    const isInbound = message.direction === "inbound";
    const isActiveConversation = isConversationObserved(client, conversationId);

    const nextConversation: WAConversation = {
        ...previousConversation,
        last_message_at: message.created_at || previousConversation.last_message_at,
        last_message_preview: buildMessagePreview(message),
        unread_count: isInbound
            ? (isActiveConversation ? 0 : (previousConversation.unread_count || 0) + 1)
            : previousConversation.unread_count || 0,
    };

    replaceConversationInCache(client, nextConversation, previousConversation);
    return true;
}
