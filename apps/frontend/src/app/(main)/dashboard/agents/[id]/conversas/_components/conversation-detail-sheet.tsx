"use client";

import { Download, Hash, MessageSquare, Clock, Star, Coins } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import type { ConversationRow } from "./columns";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Resolvida: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  Ativa: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  Escalada: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  Expirada: "bg-muted text-muted-foreground border-border",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium leading-snug">{value}</p>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
}: {
  message: { role: "user" | "assistant"; text: string; time?: string; kbRef?: string };
}) {
  const isUser = message.role === "user";
  const label = isUser ? "User" : "Bot";

  return (
    <div className={isUser ? "flex items-end justify-end gap-2" : "flex items-end justify-start gap-2"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
            : "max-w-[85%] rounded-lg bg-primary/10 px-3 py-2 text-sm"
        }
      >
        <span className="text-muted-foreground text-xs">{label}</span>
        <p className="mt-0.5 whitespace-pre-wrap break-words">{message.text}</p>
        {message.kbRef && !isUser && <p className="mt-1 text-muted-foreground text-xs">[KB] {message.kbRef}</p>}
      </div>
      {message.time ? <span className="shrink-0 text-muted-foreground text-xs">{message.time}</span> : null}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConversationDetailSheetProps {
  conversation: ConversationRow;
  onClose: () => void;
  onExportCsv: () => void;
  children?: never;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConversationDetailSheet({ conversation, onExportCsv }: ConversationDetailSheetProps) {
  const { id, data, timeRange, canal, canalLabel, status, csat, tokens, custoEst, msgs, duracao, messages } = conversation;

  const subtitle = timeRange ? `${data} ${timeRange}` : data;
  const canalDisplay = canalLabel ?? canal;
  const initials = `#${id}`;

  return (
    <>
      {/* ── Header ── */}
      <div className="relative flex items-start gap-4 border-b bg-muted/30 px-6 py-5">
        {/* Avatar */}
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
          {initials}
        </div>

        <div className="min-w-0 flex-1 pr-6">
          <h2 className="truncate text-base font-semibold leading-tight">
            Conversa #{id}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subtitle}
          </p>
          <Badge
            variant="outline"
            className={`mt-2 text-xs ${STATUS_COLORS[status] ?? ""}`}
          >
            {status}
          </Badge>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-5">
          {/* Info section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Informações
            </h3>
            <InfoRow icon={Hash} label="Canal" value={canalDisplay} />
            <InfoRow icon={Star} label="CSAT" value={csat} />
            {tokens != null && <InfoRow icon={Coins} label="Tokens" value={tokens.toLocaleString("pt-BR")} />}
            {custoEst != null && <InfoRow icon={Coins} label="Custo est." value={custoEst} />}
            {duracao && <InfoRow icon={Clock} label="Duração" value={duracao} />}
            <InfoRow icon={MessageSquare} label="Mensagens" value={String(msgs)} />
          </section>

          <Separator />

          {/* Messages section */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Histórico de mensagens
            </h3>
            <div className="space-y-4">
              {messages.map((m, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: messages have no stable id from API
                <MessageBubble key={i} message={m} />
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="border-t bg-background px-6 py-4">
        <Button variant="outline" size="sm" onClick={onExportCsv}>
          <Download className="mr-2 size-4" />
          Exportar CSV
        </Button>
      </div>
    </>
  );
}
