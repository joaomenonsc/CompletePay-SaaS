"use client";

import { useSyncExternalStore } from "react";

import type { WAMessage, WAMessageListResponse } from "@/types/whatsapp";

const STORAGE_KEY = "completepay-whatsapp-pending:v1";
const MAX_PENDING_AGE_MS = 24 * 60 * 60 * 1000;

type PersistedPendingMessage = Pick<
    WAMessage,
    | "id"
    | "conversation_id"
    | "external_message_id"
    | "client_pending_id"
    | "direction"
    | "message_type"
    | "status"
    | "body_text"
    | "media_type"
    | "media_filename"
    | "created_at"
    | "error_message"
> & {
    media_url?: string;
    persisted_at: string;
};

type PendingStore = Record<string, PersistedPendingMessage>;

const listeners = new Set<() => void>();
let storageListenerAttached = false;
const pendingSnapshotCache = new Map<string, { key: string; value: PersistedPendingMessage[] }>();

function canUseStorage(): boolean {
    return typeof window !== "undefined" && !!window.localStorage;
}

function nowIso(): string {
    return new Date().toISOString();
}

function emitChange(): void {
    for (const listener of listeners) {
        listener();
    }
}

function ensureStorageListener(): void {
    if (!canUseStorage() || storageListenerAttached) return;
    window.addEventListener("storage", (event) => {
        if (event.key === STORAGE_KEY) {
            emitChange();
        }
    });
    storageListenerAttached = true;
}

function parseStore(raw: string | null): PendingStore {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as PendingStore;
        if (!parsed || typeof parsed !== "object") return {};
        return parsed;
    } catch {
        return {};
    }
}

function readStore(): PendingStore {
    if (!canUseStorage()) return {};
    return parseStore(window.localStorage.getItem(STORAGE_KEY));
}

function writeStore(next: PendingStore): void {
    if (!canUseStorage()) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emitChange();
}

function isExpired(entry: PersistedPendingMessage): boolean {
    const persistedAt = new Date(entry.persisted_at || entry.created_at || 0).getTime();
    if (!Number.isFinite(persistedAt) || persistedAt <= 0) return true;
    return (Date.now() - persistedAt) > MAX_PENDING_AGE_MS;
}

function normalizeStore(options?: { persist?: boolean }): PendingStore {
    const current = readStore();
    let dirty = false;
    const next: PendingStore = {};
    for (const [key, entry] of Object.entries(current)) {
        if (!entry || typeof entry !== "object" || isExpired(entry)) {
            dirty = true;
            continue;
        }
        if (!entry.client_pending_id) {
            dirty = true;
            continue;
        }
        next[key] = entry;
    }
    if (dirty && options?.persist !== false) {
        writeStore(next);
    }
    return next;
}

function toPendingKey(message: Pick<WAMessage, "client_pending_id" | "external_message_id">): string | null {
    const clientPendingId = (message.client_pending_id || "").trim();
    if (clientPendingId) return clientPendingId;
    const externalId = (message.external_message_id || "").trim();
    if (externalId.startsWith("pending:")) return externalId;
    return null;
}

export function buildClientPendingId(): string {
    const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `pending:${suffix}`;
}

export function buildOptimisticMessageId(clientPendingId: string): string {
    return `optimistic:${clientPendingId}`;
}

export function upsertPersistedPendingMessage(
    message: Omit<PersistedPendingMessage, "persisted_at">
): void {
    const clientPendingId = (message.client_pending_id || "").trim();
    if (!clientPendingId) return;
    const store = normalizeStore();
    store[clientPendingId] = {
        ...message,
        client_pending_id: clientPendingId,
        persisted_at: nowIso(),
    };
    writeStore(store);
}

export function removePersistedPendingMessage(clientPendingId: string | null | undefined): void {
    const normalized = (clientPendingId || "").trim();
    if (!normalized) return;
    const store = normalizeStore();
    if (!(normalized in store)) return;
    delete store[normalized];
    writeStore(store);
}

export function markPersistedPendingMessageFailed(
    clientPendingId: string,
    errorMessage: string
): void {
    const normalized = clientPendingId.trim();
    if (!normalized) return;
    const store = normalizeStore();
    const current = store[normalized];
    if (!current) return;
    store[normalized] = {
        ...current,
        status: "failed",
        error_message: errorMessage,
        persisted_at: nowIso(),
    };
    writeStore(store);
}

export function getPersistedPendingMessages(conversationId: string | null): PersistedPendingMessage[] {
    if (!conversationId) return [];
    const store = normalizeStore({ persist: false });
    const nextValue = Object.values(store)
        .filter((entry) => entry.conversation_id === conversationId)
        .sort((left, right) => {
            const diff = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
            if (diff !== 0) return diff;
            return left.id.localeCompare(right.id);
        });
    const snapshotKey = JSON.stringify(nextValue);
    const cached = pendingSnapshotCache.get(conversationId);
    if (cached && cached.key === snapshotKey) {
        return cached.value;
    }
    pendingSnapshotCache.set(conversationId, { key: snapshotKey, value: nextValue });
    return nextValue;
}

export function reconcilePersistedPendingMessages(messages: readonly WAMessage[]): void {
    const toRemove = new Set<string>();
    for (const message of messages) {
        const key = toPendingKey(message);
        if (key) toRemove.add(key);
    }
    if (toRemove.size === 0) return;
    const store = normalizeStore();
    let dirty = false;
    for (const key of toRemove) {
        if (key in store) {
            delete store[key];
            dirty = true;
        }
    }
    if (dirty) {
        writeStore(store);
    }
}

function toPersistedWAMessage(entry: PersistedPendingMessage): WAMessage {
    return {
        id: entry.id,
        organization_id: "",
        conversation_id: entry.conversation_id,
        contact_id: "",
        external_message_id: entry.external_message_id,
        client_pending_id: entry.client_pending_id,
        direction: entry.direction,
        message_type: entry.message_type,
        status: entry.status,
        body_text: entry.body_text,
        media_url: entry.media_url,
        media_type: entry.media_type,
        media_filename: entry.media_filename,
        error_message: entry.error_message,
        created_at: entry.created_at,
    };
}

export function mergePersistedPendingWithMessages(
    serverData: WAMessageListResponse | undefined,
    persistedEntries: PersistedPendingMessage[],
    fallback: { limit?: number; offset?: number } = {}
): WAMessageListResponse | undefined {
    if (!serverData && persistedEntries.length === 0) {
        return undefined;
    }

    const serverItems = serverData?.items ?? [];
    const serverPendingKeys = new Set(
        serverItems
            .map((message) => toPendingKey(message))
            .filter((value): value is string => !!value)
    );

    const mergedItems = [
        ...serverItems,
        ...persistedEntries
            .filter((entry) => !serverPendingKeys.has(entry.client_pending_id || ""))
            .map(toPersistedWAMessage),
    ].sort((left, right) => {
        const diff = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
        if (diff !== 0) return diff;
        return left.id.localeCompare(right.id);
    });

    return {
        items: mergedItems,
        total: Math.max(serverData?.total ?? 0, mergedItems.length),
        limit: serverData?.limit ?? fallback.limit ?? 100,
        offset: serverData?.offset ?? fallback.offset ?? 0,
    };
}

export function usePersistedPendingMessages(conversationId: string | null): PersistedPendingMessage[] {
    ensureStorageListener();
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        () => getPersistedPendingMessages(conversationId),
        () => [],
    );
}
