"use client";

export type WhatsAppUxMetricName =
    | "inbox_tti"
    | "conversation_tti"
    | "conversation_first_message"
    | "action_feedback";

export type WhatsAppUxMetricRecord = {
    id: string;
    name: WhatsAppUxMetricName;
    started_at: string;
    finished_at: string;
    duration_ms: number;
    meta?: Record<string, unknown>;
};

type PendingMetric = {
    id: string;
    name: WhatsAppUxMetricName;
    startedAtMs: number;
    startedAtIso: string;
    meta?: Record<string, unknown>;
};

const MAX_METRIC_RECORDS = 300;
const pendingMetrics = new Map<string, PendingMetric>();
const metricRecords: WhatsAppUxMetricRecord[] = [];

function buildMetricId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `wa-ux-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneRecord(record: WhatsAppUxMetricRecord): WhatsAppUxMetricRecord {
    return {
        ...record,
        meta: record.meta ? { ...record.meta } : undefined,
    };
}

function ensureGlobalBindings() {
    if (typeof window === "undefined") return;

    window.__waUxMetrics = {
        getRecords: () => metricRecords.map(cloneRecord),
        getPendingCount: () => pendingMetrics.size,
        summary: () => summarizeWhatsAppUxMetrics(),
        clear: () => {
            pendingMetrics.clear();
            metricRecords.length = 0;
        },
    };
}

function emitMetric(record: WhatsAppUxMetricRecord) {
    if (typeof window === "undefined") return;
    ensureGlobalBindings();
    window.dispatchEvent(
        new CustomEvent("wa-ux-metric", {
            detail: cloneRecord(record),
        })
    );
}

export function beginWhatsAppUxMetric(
    name: WhatsAppUxMetricName,
    meta?: Record<string, unknown>
): string {
    const id = buildMetricId();
    pendingMetrics.set(id, {
        id,
        name,
        startedAtMs: performance.now(),
        startedAtIso: new Date().toISOString(),
        meta,
    });
    ensureGlobalBindings();
    return id;
}

export function completeWhatsAppUxMetric(
    id: string | null | undefined,
    meta?: Record<string, unknown>
): WhatsAppUxMetricRecord | null {
    if (!id) return null;
    const pending = pendingMetrics.get(id);
    if (!pending) return null;
    pendingMetrics.delete(id);

    const record: WhatsAppUxMetricRecord = {
        id: pending.id,
        name: pending.name,
        started_at: pending.startedAtIso,
        finished_at: new Date().toISOString(),
        duration_ms: Number((performance.now() - pending.startedAtMs).toFixed(1)),
        meta: {
            ...(pending.meta ?? {}),
            ...(meta ?? {}),
        },
    };

    metricRecords.unshift(record);
    if (metricRecords.length > MAX_METRIC_RECORDS) {
        metricRecords.length = MAX_METRIC_RECORDS;
    }

    emitMetric(record);
    return record;
}

export function abandonWhatsAppUxMetric(id: string | null | undefined): void {
    if (!id) return;
    pendingMetrics.delete(id);
    ensureGlobalBindings();
}

export function summarizeWhatsAppUxMetrics(): Record<string, {
    count: number;
    avg_ms: number;
    p95_ms: number;
    last_ms: number;
}> {
    const grouped = new Map<string, number[]>();

    for (const record of metricRecords) {
        const current = grouped.get(record.name) ?? [];
        current.push(record.duration_ms);
        grouped.set(record.name, current);
    }

    return Object.fromEntries(
        Array.from(grouped.entries()).map(([name, values]) => {
            const sorted = [...values].sort((a, b) => a - b);
            const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
            const p95Index = Math.min(
                sorted.length - 1,
                Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
            );
            return [name, {
                count: sorted.length,
                avg_ms: Number(avg.toFixed(1)),
                p95_ms: Number(sorted[p95Index].toFixed(1)),
                last_ms: Number(sorted[sorted.length - 1].toFixed(1)),
            }];
        })
    );
}

declare global {
    interface Window {
        __waUxMetrics?: {
            getRecords: () => WhatsAppUxMetricRecord[];
            getPendingCount: () => number;
            summary: () => Record<string, {
                count: number;
                avg_ms: number;
                p95_ms: number;
                last_ms: number;
            }>;
            clear: () => void;
        };
    }
}
