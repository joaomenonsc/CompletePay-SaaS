"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    MessageCircle,
    Search,
    Filter,
    Wifi,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ConversationListItem } from "@/components/whatsapp/conversation-list-item";
import { ConversationPanel } from "@/components/whatsapp/conversation-panel";
import { useDebounce } from "@/hooks/use-debounce";
import { useConversations, useAccounts, usePrefetchConversationThread } from "@/hooks/use-whatsapp";
import { useInboxWebSocket, type WsStatus } from "@/hooks/use-inbox-ws";
import { getContactDisplayName, getContactPhone } from "@/lib/whatsapp-contact";
import { markConversationReadOptimistically } from "@/lib/whatsapp-query-cache";
import {
    abandonWhatsAppUxMetric,
    beginWhatsAppUxMetric,
    completeWhatsAppUxMetric,
} from "@/lib/whatsapp-ux-metrics";

// Conecta um WS por conta conectada ao Evolution
function AccountWsConnector({
    accountId,
    onStatus,
}: {
    accountId: string;
    onStatus: (id: string, s: WsStatus) => void;
}) {
    useInboxWebSocket({
        accountId,
        onStatusChange: (s) => onStatus(accountId, s),
    });
    return null;
}

function ConversationListSkeleton() {
    return (
        <div className="divide-y">
            {Array.from({ length: 8 }).map((_, index) => (
                <div key={`wa-conv-skeleton-${index}`} className="flex items-start gap-3 px-3 py-3">
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-28 rounded-full" />
                                <Skeleton className="h-3 w-36 rounded-full" />
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <Skeleton className="h-3 w-12 rounded-full" />
                                <Skeleton className="h-4 w-4 rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function WhatsAppInbox() {
    const qc = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>("open");
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [wsStatuses, setWsStatuses] = useState<Record<string, WsStatus>>({});
    const prefetchConversationThread = usePrefetchConversationThread({ limit: 100 });
    const debouncedSearch = useDebounce(search, 250);
    const debouncedStatusFilter = useDebounce(statusFilter, 150);

    // Estável — não trocado entre renders, evita re-mount do WS
    const handleWsStatus = useCallback((id: string, s: WsStatus) => {
        setWsStatuses((prev) => ({ ...prev, [id]: s }));
    }, []);

    const { data, isLoading, isError } = useConversations({
        status: debouncedStatusFilter === "all" ? undefined : debouncedStatusFilter,
        limit: 50,
        refetchIntervalMs: selectedId ? 15_000 : 8_000,
    });

    // Contas para conectar WS
    const { data: accountsData } = useAccounts();
    const connectedAccounts = (accountsData?.items ?? []).filter(
        (a) => a.status === "connected" && a.provider === "evolution"
    );

    const normalizedSearch = debouncedSearch.trim().toLowerCase();
    const inboxTtiMetricRef = useRef<string | null>(null);

    useEffect(() => {
        inboxTtiMetricRef.current = beginWhatsAppUxMetric("inbox_tti", {
            screen: "whatsapp_inbox",
        });
        return () => {
            abandonWhatsAppUxMetric(inboxTtiMetricRef.current);
        };
    }, []);

    useEffect(() => {
        if (isLoading || !inboxTtiMetricRef.current) return;
        completeWhatsAppUxMetric(inboxTtiMetricRef.current, {
            conversations_total: data?.total ?? 0,
            result: isError ? "error" : "ready",
        });
        inboxTtiMetricRef.current = null;
    }, [data?.total, isError, isLoading]);

    const conversations = useMemo(() => {
        const items = data?.items ?? [];
        if (!normalizedSearch) return items;

        return items.filter((conv) => {
            const name = getContactDisplayName(conv.contact);
            const phone = getContactPhone(conv.contact);
            const preview = conv.last_message_preview || "";
            const searchableText = `${name} ${phone} ${preview}`.toLowerCase();
            return searchableText.includes(normalizedSearch);
        });
    }, [data?.items, normalizedSearch]);

    // Status geral do WS (connected se pelo menos um está connected)
    const overallWs: WsStatus = useMemo(() => {
        const wsValues = Object.values(wsStatuses);
        return wsValues.includes("connected")
            ? "connected"
            : wsValues.includes("connecting")
                ? "connecting"
                : "disconnected";
    }, [wsStatuses]);

    return (
        <>
            {/* Conectar WS para cada conta Evolution ativa */}
            {connectedAccounts.map((acc) => (
                <AccountWsConnector
                    key={acc.id}
                    accountId={acc.id}
                    onStatus={handleWsStatus}
                />
            ))}

            <div className="flex -m-4 md:-m-6 h-[calc(100svh-3rem)] overflow-hidden">
                {/* ── Sidebar — lista de conversas ──────── */}
                <aside className="flex w-80 shrink-0 flex-col border-r xl:w-96">
                    {/* Cabeçalho */}
                    <div className="shrink-0 flex items-start justify-between px-4 pb-3 pt-5">
                        <div>
                            <h1 className="text-xl font-semibold">Inbox</h1>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {data?.total ?? 0} conversa{(data?.total ?? 0) !== 1 ? "s" : ""}
                            </p>
                        </div>
                        {/* Indicador WS */}
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                            <span
                                className={cn(
                                    "size-2 rounded-full",
                                    overallWs === "connected"
                                        ? "bg-emerald-500 animate-pulse"
                                        : overallWs === "connecting"
                                            ? "bg-amber-400 animate-pulse"
                                            : "bg-slate-400"
                                )}
                            />
                            <span className="text-muted-foreground">
                                {overallWs === "connected"
                                    ? "Tempo real"
                                    : overallWs === "connecting"
                                        ? "Conectando..."
                                        : "Offline"}
                            </span>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="shrink-0 flex gap-2 px-4 pb-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Buscar conversa..."
                                className="pl-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-32">
                                <Filter className="mr-1 size-3.5" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                <SelectItem value="open">Abertas</SelectItem>
                                <SelectItem value="resolved">Resolvidas</SelectItem>
                                <SelectItem value="archived">Arquivadas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Lista */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="px-1 pb-3">
                                <ConversationListSkeleton />
                            </div>
                        ) : isError ? (
                            <p className="py-10 text-center text-sm text-muted-foreground">
                                Erro ao carregar conversas.
                            </p>
                        ) : conversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                                <MessageCircle className="mb-3 size-10 text-muted-foreground/40" />
                                <p className="text-sm font-medium">Nenhuma conversa</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Conversas aparecerão aqui quando os clientes enviarem mensagens.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {conversations.map((conv) => (
                                    <ConversationListItem
                                        key={conv.id}
                                        conversation={conv}
                                        isActive={conv.id === selectedId}
                                        onHover={() => prefetchConversationThread(conv.id)}
                                        onClick={() => {
                                            prefetchConversationThread(conv.id);
                                            markConversationReadOptimistically(qc, conv.id);
                                            setSelectedId(conv.id);
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

                {/* ── Painel principal — chat ─────────── */}
                <main className="flex flex-1 flex-col overflow-hidden">
                    {selectedId ? (
                        <ConversationPanel conversationId={selectedId} />
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                            {overallWs === "connected" ? (
                                <Wifi className="size-12 text-emerald-500/50" />
                            ) : (
                                <MessageCircle className="size-12 text-muted-foreground/30" />
                            )}
                            <p className="text-sm font-medium text-muted-foreground">
                                Selecione uma conversa
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {overallWs === "connected"
                                    ? "Mensagens chegam em tempo real ✓"
                                    : "Clique em uma conversa à esquerda para visualizá-la."}
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
