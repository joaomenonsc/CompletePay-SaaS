"use client";

import type { ReactNode } from "react";

import { useAgent } from "@/hooks/use-agents";

import { AgentHeader } from "./agent-header";
import { AgentTabs } from "./agent-tabs";

export function AgentLayoutClient({ id, children }: { id: string; children: ReactNode }) {
  const { data: agent, isLoading } = useAgent(id);

  const fallback = {
    name: "Agente",
    imageUrl: null as string | null,
    status: "rascunho" as const,
  };

  const name = agent?.name ?? fallback.name;
  const imageUrl = agent?.imageUrl ?? fallback.imageUrl;
  const status = agent?.status ?? fallback.status;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-0">
        <div className="flex shrink-0 items-center gap-4 bg-background/95 pb-3">
          <div className="text-muted-foreground text-sm">Carregando agente...</div>
        </div>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col gap-0">
        <div className="flex shrink-0 items-center gap-4 bg-background/95 pb-3">
          <p className="text-muted-foreground text-sm">Agente não encontrado.</p>
        </div>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      <AgentHeader agentId={id} name={name} imageUrl={imageUrl} status={status} />
      <AgentTabs agentId={id} />
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
