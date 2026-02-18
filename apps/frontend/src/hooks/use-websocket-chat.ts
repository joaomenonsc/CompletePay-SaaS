"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthStore } from "@/store/auth-store";

// ─── Tipos do protocolo WebSocket ───────────────────────────────

export interface WsMessage {
  type: "message" | "ping";
  content: string;
  session_id?: string | null;
}

export interface WsServerEvent {
  type: "stream_start" | "token" | "stream_end" | "error" | "pong";
  content?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseWebSocketChatOptions {
  /** URL base do WebSocket (sem query params). Default: ws://localhost:8000/ws/chat */
  url?: string;
  /** Session ID para manter historico. */
  sessionId: string;
  /** Mensagem inicial do bot. */
  initialMessage?: string;
  /** Intervalo do heartbeat em ms. Default: 30000 (30s). */
  heartbeatInterval?: number;
  /** Tentar reconectar automaticamente. Default: true. */
  autoReconnect?: boolean;
  /** Maximo de tentativas de reconexao. Default: 5. */
  maxReconnectAttempts?: number;
  /** Construtor WebSocket (para testes). Default: global WebSocket. */
  wsConstructor?: typeof WebSocket;
}

interface UseWebSocketChatReturn {
  /** Lista de mensagens (user + assistant). */
  messages: ChatMessage[];
  /** Status da conexao WebSocket. */
  status: ConnectionStatus;
  /** Envia uma mensagem de texto. */
  sendMessage: (content: string) => void;
  /** Limpa historico e reseta para mensagem inicial. */
  resetChat: () => void;
  /** Se o assistente esta gerando resposta. */
  isStreaming: boolean;
}

// ─── Configuracao padrao ─────────────────────────────────────────

const DEFAULT_WS_URL = (() => {
  if (typeof window === "undefined") return "ws://localhost:8000/ws/chat";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return apiUrl.replace(/^http/, "ws") + "/ws/chat";
})();

const DEFAULT_INITIAL_MESSAGE =
  "Olá! Sou o assistente virtual da CompletePay. Como posso ajudar?";

// ─── Hook ────────────────────────────────────────────────────────

export function useWebSocketChat(
  options: UseWebSocketChatOptions,
): UseWebSocketChatReturn {
  const {
    url = DEFAULT_WS_URL,
    sessionId,
    initialMessage = DEFAULT_INITIAL_MESSAGE,
    heartbeatInterval = 30_000,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    wsConstructor = typeof WebSocket !== "undefined" ? WebSocket : undefined,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "0", role: "assistant", content: initialMessage },
  ]);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isStreaming, setIsStreaming] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamBufferRef = useRef("");
  const messageCountRef = useRef(1);

  const _clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (
      wsRef.current?.readyState === 1 ||
      wsRef.current?.readyState === 0
    ) {
      return;
    }

    const token = useAuthStore.getState().token;
    if (!token) {
      setStatus("error");
      return;
    }

    if (!wsConstructor) {
      setStatus("error");
      return;
    }
    setStatus("connecting");
    const wsUrl = `${url}?token=${encodeURIComponent(token)}`;
    const ws = new wsConstructor(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      reconnectAttemptsRef.current = 0;
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, heartbeatInterval);
    };

    ws.onmessage = (event) => {
      try {
        const data: WsServerEvent = JSON.parse(event.data);

        switch (data.type) {
          case "stream_start":
            setIsStreaming(true);
            streamBufferRef.current = "";
            setMessages((prev) => [
              ...prev,
              {
                id: String(messageCountRef.current++),
                role: "assistant",
                content: "",
                isStreaming: true,
              },
            ]);
            break;

          case "token":
            if (data.content) {
              streamBufferRef.current += data.content;
              const currentBuffer = streamBufferRef.current;
              setMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    content: currentBuffer,
                  };
                }
                return updated;
              });
            }
            break;

          case "stream_end":
            setIsStreaming(false);
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: data.content || streamBufferRef.current,
                  isStreaming: false,
                };
              }
              return updated;
            });
            streamBufferRef.current = "";
            break;

          case "error":
            setIsStreaming(false);
            setMessages((prev) => [
              ...prev,
              {
                id: String(messageCountRef.current++),
                role: "assistant",
                content: data.content || "Erro ao processar mensagem.",
              },
            ]);
            break;

          case "pong":
            break;
        }
      } catch {
        // Ignora mensagens que nao sao JSON valido
      }
    };

    ws.onclose = (event) => {
      setStatus("disconnected");
      setIsStreaming(false);
      _clearHeartbeat();

      if (
        autoReconnect &&
        event.code !== 1000 &&
        reconnectAttemptsRef.current < maxReconnectAttempts
      ) {
        const delay = Math.min(
          1000 * 2 ** reconnectAttemptsRef.current,
          30_000,
        );
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };
  }, [
    url,
    heartbeatInterval,
    autoReconnect,
    maxReconnectAttempts,
    _clearHeartbeat,
    wsConstructor,
  ]);

  const sendMessage = useCallback(
    (content: string) => {
      const text = content.trim();
      if (
        !text ||
        !wsRef.current ||
        wsRef.current.readyState !== 1 ||
        isStreaming
      ) {
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: String(messageCountRef.current++), role: "user", content: text },
      ]);

      const payload: WsMessage = {
        type: "message",
        content: text,
        session_id: sessionId,
      };
      wsRef.current.send(JSON.stringify(payload));
    },
    [sessionId, isStreaming],
  );

  const resetChat = useCallback(() => {
    messageCountRef.current = 1;
    setMessages([
      { id: "0", role: "assistant", content: initialMessage },
    ]);
    setIsStreaming(false);
    streamBufferRef.current = "";
  }, [initialMessage]);

  useEffect(() => {
    connect();

    return () => {
      _clearHeartbeat();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [connect, _clearHeartbeat]);

  return {
    messages,
    status,
    sendMessage,
    resetChat,
    isStreaming,
  };
}
