"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { ConversationRow } from "./columns";

interface ConversationDetailSheetProps {
  conversation: ConversationRow;
  onClose: () => void;
  onExportCsv: () => void;
  /** Conteúdo do Sheet (SheetContent) para poder usar dentro do Sheet existente */
  children?: never;
}

export function ConversationDetailSheet({ conversation, onExportCsv }: ConversationDetailSheetProps) {
  const { id, data, timeRange, canal, canalLabel, status, csat, tokens, custoEst, messages } = conversation;

  const subtitle = timeRange ? `${data} ${timeRange}` : data;
  const canalDisplay = canalLabel ?? canal;

  return (
    <>
      <header className="flex flex-col gap-1 border-b px-4 pt-2 pb-4">
        <h2 className="font-semibold text-foreground">Conversa #{id}</h2>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </header>

      <div className="grid gap-1 px-4 py-2 text-sm">
        <MetaRow label="Canal" value={canalDisplay} />
        <MetaRow label="Status" value={status} />
        <MetaRow label="CSAT" value={csat} />
        {tokens != null && <MetaRow label="Tokens" value={formatTokens(tokens)} />}
        {custoEst != null && <MetaRow label="Custo est." value={custoEst} />}
      </div>

      <hr className="border-border" />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {messages.map((m, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: messages have no stable id from API
            <MessageBubble key={i} message={m} />
          ))}
        </div>
      </div>

      <footer className="border-t p-4">
        <Button variant="outline" size="sm" onClick={onExportCsv}>
          <Download className="size-4" />
          Exportar CSV
        </Button>
      </footer>
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function formatTokens(n: number) {
  return n.toLocaleString("pt-BR");
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
