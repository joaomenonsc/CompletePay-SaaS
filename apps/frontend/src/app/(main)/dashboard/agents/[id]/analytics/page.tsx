"use client";

import { useState } from "react";

import { useParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgent, useAgents } from "@/hooks/use-agents";

import { AnalyticsCanais } from "./_components/analytics-canais";
import { AnalyticsChartConversas } from "./_components/analytics-chart-conversas";
import { AnalyticsComparisonTable, getMockMetricsForAgent } from "./_components/analytics-comparison-table";
import { AnalyticsKpiCards } from "./_components/analytics-kpi-cards";
import { AnalyticsTopPerguntas } from "./_components/analytics-top-perguntas";

const PERIODS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
] as const;

const COMPARE_OPTIONS = [
  { value: "none", label: "Nenhum" },
  // Comparação com outro período ou agente pode ser adicionada depois
] as const;

export default function AgentAnalyticsPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: agent, isLoading } = useAgent(id);
  const { data: agents = [] } = useAgents();
  const [compareWith, setCompareWith] = useState<string>("none");

  const comparedAgent = compareWith && compareWith !== "none" ? agents.find((a) => a.id === compareWith) : null;

  if (isLoading) {
    return (
      <div className="space-y-6 py-4">
        <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {!agent ? (
        <p className="text-muted-foreground text-sm">Agente não encontrado.</p>
      ) : (
        <>
          {/* Header: título + Período + Comparar com */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-lg">Analytics</h2>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="mb-1 block text-muted-foreground text-sm" htmlFor="analytics-period-select">
                  Período
                </label>
                <Select defaultValue="7d">
                  <SelectTrigger id="analytics-period-select" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-muted-foreground text-sm" htmlFor="analytics-compare-select">
                  Comparar com
                </label>
                <Select value={compareWith} onValueChange={(v) => setCompareWith(v)}>
                  <SelectTrigger id="analytics-compare-select" className="w-[200px]">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPARE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                    {agents
                      .filter((a) => a.id !== id)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Comparação entre agentes (quando "Comparar com" está selecionado) */}
          {comparedAgent && (
            <AnalyticsComparisonTable
              currentAgentName={agent.name}
              comparedAgentName={comparedAgent.name}
              currentMetrics={getMockMetricsForAgent(id, "current")}
              comparedMetrics={getMockMetricsForAgent(comparedAgent.id, "compared")}
            />
          )}

          {/* KPI Cards */}
          <AnalyticsKpiCards />

          {/* Gráfico: Conversas por Dia */}
          <AnalyticsChartConversas />

          {/* Canais + Top 5 Perguntas */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AnalyticsCanais />
            <AnalyticsTopPerguntas />
          </div>
        </>
      )}
    </div>
  );
}
