"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useParams } from "next/navigation";

import { Bot, Info, RotateCcw, Send, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgent } from "@/hooks/use-agents";
import { useWebSocketChat } from "@/hooks/use-websocket-chat";
import { API_BASE_URL, API_ENDPOINTS } from "@/lib/api-config";
import { cn } from "@/lib/utils";

const ERROR_MESSAGE_PREFIX = "Não foi possível obter resposta.";

export default function AgentPlaygroundPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: agent } = useAgent(id);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [hasMounted, setHasMounted] = useState(false);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    setHasMounted(true);
    setSessionId(
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `playground-${Date.now()}`,
    );
  }, []);

  const {
    messages,
    status,
    sendMessage,
    resetChat,
    isStreaming,
  } = useWebSocketChat({
    url: API_ENDPOINTS.wsChat(),
    sessionId,
  });

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const lastMessageIsError =
    lastAssistantMessage?.content?.startsWith(ERROR_MESSAGE_PREFIX) ?? false;
  const lastSources = lastMessageIsError ? [] : (lastAssistantMessage as { kbSources?: { file: string; chunk: number }[] })?.kbSources ?? [];
  const kbConsulted = !lastMessageIsError && lastSources.length > 0;
  const sessionMessages = messages.length;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const handleReset = useCallback(() => {
    resetChat();
  }, [resetChat]);

  // Antes de montar: servidor e cliente renderizam o mesmo (evita hydration error com store)
  if (!hasMounted) {
    return (
      <div className="py-4">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="py-4">
        <p className="text-muted-foreground text-sm">Agente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[420px] flex-col gap-0 py-4 lg:flex-row lg:gap-4">
      {/* Chat Area ~65%: coluna com altura fixa, só a lista de mensagens rola */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-muted/30 lg:max-w-[65%]">
        <div className="shrink-0 space-y-2 border-b px-4 py-2">
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
            <Info className="size-4 shrink-0 text-muted-foreground" />
            <span>Modo Sandbox — conversas não contam para métricas</span>
          </div>
          {(status === "disconnected" || status === "error") && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/15 px-3 py-2 text-destructive text-sm">
              <span className="size-2 rounded-full bg-destructive" />
              {status === "error"
                ? "Erro na conexão WebSocket — verifique sua autenticação."
                : "Desconectado — tentando reconectar..."}
            </div>
          )}
          {status === "connecting" && (
            <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/15 px-3 py-2 text-yellow-700 dark:text-yellow-400 text-sm">
              <span className="size-2 animate-pulse rounded-full bg-yellow-500" />
              Conectando ao servidor...
            </div>
          )}
        </div>

        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
          <div className="space-y-4 px-4 py-3 pb-4">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                <div
                  className={cn(
                    "flex max-w-[85%] shrink-0 gap-2 rounded-lg border p-3",
                    msg.role === "user" ? "border-primary/30 bg-primary text-primary-foreground" : "bg-background",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <Bot className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <User className="mt-0.5 size-4 shrink-0 opacity-80" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium text-sm">{msg.role === "assistant" ? "Bot" : "User"}</p>
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    {(() => {
                      const sources = (msg as { kbSources?: { file: string; chunk: number }[] }).kbSources;
                      return Array.isArray(sources) && sources.length > 0 ? (
                        <div className="mt-2 border-t pt-2 text-muted-foreground text-xs">
                          <span className="font-medium">[KB]</span>{" "}
                          {sources.map((s) => `${s.file} chunk #${s.chunk}`).join(", ")}
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.isStreaming && (
              <div className="flex gap-3">
                <div className="flex max-w-[85%] gap-2 rounded-lg border bg-muted p-3">
                  <Bot className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="inline-block size-2 animate-pulse rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="shrink-0 space-y-2 border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Digite sua mensagem..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="min-w-0 flex-1"
              disabled={isStreaming || status !== "connected"}
            />
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming || status !== "connected"}
              aria-label="Enviar"
            >
              <Send className="size-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="size-4" />
            Reset Conversa
          </Button>
        </div>
      </div>

      {/* Metadata ~35% */}
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/20 p-4 lg:w-[35%] lg:max-w-[400px]">
        <div>
          <h3 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Configuração</h3>
          <ul className="space-y-1 text-sm">
            <li>
              <span className="text-muted-foreground">Modelo:</span> Claude Sonnet 4.5
            </li>
            <li>
              <span className="text-muted-foreground">Temperatura:</span> 0.7
            </li>
            <li>
              <span className="text-muted-foreground">Strategy:</span> Speed
            </li>
          </ul>
        </div>

        <div className="border-t pt-3">
          <h3 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Última Mensagem</h3>
          <ul className="space-y-1 text-sm">
            {lastMessageIsError ? (
              <li className="text-muted-foreground">
                Erro na última resposta (backend offline ou falha na requisição).
              </li>
            ) : (
              <>
                <li>
                  <span className="text-muted-foreground">KB Consultada:</span> {kbConsulted ? "Sim" : "Não"}
                </li>
                {lastSources.length > 0 && (
                  <li className="pt-1">
                    <span className="text-muted-foreground">Sources:</span>
                    <ul className="mt-1 list-inside list-disc text-xs">
                      {lastSources.map((s) => (
                        <li key={`${s.file}-${s.chunk}`}>
                          {s.file} chunk #{s.chunk}
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
              </>
            )}
          </ul>
        </div>

        <div className="border-t pt-3">
          <h3 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sessão</h3>
          <ul className="space-y-1 text-sm">
            <li>
              <span className="text-muted-foreground">Mensagens:</span> {sessionMessages}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
