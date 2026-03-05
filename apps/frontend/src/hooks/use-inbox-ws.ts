"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api-config";
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
                    const msg = event.message as Record<string, unknown>;
                    if (!convId) break;
                    client.setQueriesData(
                        { queryKey: ["wa-messages", convId] },
                        (old: { items: unknown[]; total: number } | undefined) => {
                            if (!old) return old;
                            const exists = old.items.some(
                                (m: unknown) => (m as { id: string }).id === msg.id
                            );
                            if (exists) return old;
                            return { ...old, items: [...old.items, msg], total: old.total + 1 };
                        }
                    );
                    client.invalidateQueries({ queryKey: ["wa-conversations"] });
                    break;
                }
                case "message.update":
                    client.invalidateQueries({ queryKey: ["wa-messages"] });
                    break;
                case "connection.update":
                    client.invalidateQueries({ queryKey: ["wa-accounts"] });
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
