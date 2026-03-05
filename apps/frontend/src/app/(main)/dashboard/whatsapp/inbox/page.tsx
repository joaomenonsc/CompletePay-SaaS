"use client";

import { useState, useCallback } from "react";
import {
    MessageCircle,
    Search,
    Loader2,
    Filter,
    Wifi,
    WifiOff,
} from "lucide-react";

import { Input } from "@/components/ui/input";
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
import { useConversations, useAccounts } from "@/hooks/use-whatsapp";
import { useInboxWebSocket, type WsStatus } from "@/hooks/use-inbox-ws";

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

export default function WhatsAppInbox() {
    const [statusFilter, setStatusFilter] = useState<string>("open");
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [wsStatuses, setWsStatuses] = useState<Record<string, WsStatus>>({});

    // Estável — não trocado entre renders, evita re-mount do WS
    const handleWsStatus = useCallback((id: string, s: WsStatus) => {
        setWsStatuses((prev) => ({ ...prev, [id]: s }));
    }, []);

    const { data, isLoading, isError } = useConversations({
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 50,
    });

    // Contas para conectar WS
    const { data: accountsData } = useAccounts();
    const connectedAccounts = (accountsData?.items ?? []).filter(
        (a) => a.status === "connected" && a.provider === "evolution"
    );

    const conversations = (data?.items ?? []).filter((conv) => {
        if (!search) return true;
        const name =
            conv.contact?.display_name ||
            conv.contact?.phone_display ||
            conv.contact?.phone_e164 ||
            "";
        const preview = conv.last_message_preview || "";
        const q = search.toLowerCase();
        return name.toLowerCase().includes(q) || preview.toLowerCase().includes(q);
    });

    // Status geral do WS (connected se pelo menos um está connected)
    const wsValues = Object.values(wsStatuses);
    const overallWs: WsStatus =
        wsValues.includes("connected")
            ? "connected"
            : wsValues.includes("connecting")
                ? "connecting"
                : "disconnected";

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
                            <div className="flex justify-center py-16">
                                <Loader2 className="size-6 animate-spin text-muted-foreground" />
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
                                        onClick={() => setSelectedId(conv.id)}
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
