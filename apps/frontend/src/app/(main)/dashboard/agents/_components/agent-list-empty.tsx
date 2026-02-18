"use client";

import Link from "next/link";

import { Bot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AGENT_CATEGORIES, CATEGORY_IDS } from "@/lib/agent-categories";

export function AgentListEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
        <Bot className="size-12" strokeWidth={1.25} />
      </div>
      <h2 className="font-semibold text-lg">Nenhum agente criado ainda</h2>
      <p className="mt-2 max-w-sm text-muted-foreground text-sm">
        Crie seu primeiro agente de IA para automatizar o atendimento dos seus clientes.
      </p>
      <Button asChild className="mt-6" size="lg">
        <Link prefetch={false} href="/dashboard/agents/novo/categoria">
          Criar Primeiro Agente
        </Link>
      </Button>
      <p className="mt-8 text-muted-foreground text-xs">Categorias disponíveis:</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {CATEGORY_IDS.slice(0, 5).map((id) => {
          const { label } = AGENT_CATEGORIES[id] ?? { label: id };
          return (
            <span key={id} className="rounded-full bg-muted px-3 py-1 text-muted-foreground text-xs">
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
