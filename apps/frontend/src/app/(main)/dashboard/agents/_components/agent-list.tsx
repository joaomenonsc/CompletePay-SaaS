"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { PlusCircle, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgents } from "@/hooks/use-agents";
import { AGENT_CATEGORIES, CATEGORY_IDS } from "@/lib/agent-categories";
import type { Agent, AgentStatus } from "@/types/agent";
import { useOrganizationStore } from "@/store/organization-store";

import { AgentCard } from "./agent-card";
import { AgentCardSkeleton } from "./agent-card-skeleton";
import { AgentListEmpty } from "./agent-list-empty";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Status" },
  { value: "ativo", label: "Ativo" },
  { value: "rascunho", label: "Draft" },
  { value: "pausado", label: "Pausado" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "Categoria" },
  ...CATEGORY_IDS.map((id) => ({
    value: id,
    label: AGENT_CATEGORIES[id]?.label ?? id,
  })),
];

function filterAgents(agents: Agent[], search: string, category: string, status: string): Agent[] {
  let result = agents;
  const q = search.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.description?.toLowerCase().includes(q) ?? false),
    );
  }
  if (category !== "all") {
    result = result.filter((a) => a.category === category);
  }
  if (status !== "all") {
    result = result.filter((a) => a.status === (status as AgentStatus));
  }
  return result;
}

export function AgentList() {
  const currentOrganizationId = useOrganizationStore((s) => s.currentOrganizationId);
  const { data: agents = [], isLoading } = useAgents();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => filterAgents(agents, search, category, status), [agents, search, category, status]);

  if (!currentOrganizationId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        <p className="font-medium">Selecione uma organização</p>
        <p className="mt-1 text-sm">Use o menu no topo da página para escolher a organização e listar os agentes.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <AgentCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return <AgentListEmpty />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar agentes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild size="sm">
          <Link prefetch={false} href="/dashboard/agents/novo/categoria">
            <PlusCircle className="size-4" />
            Novo Agente
          </Link>
        </Button>
        <p className="text-muted-foreground text-sm">
          Mostrando {filtered.length} agente{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          Nenhum agente encontrado com os filtros aplicados.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
