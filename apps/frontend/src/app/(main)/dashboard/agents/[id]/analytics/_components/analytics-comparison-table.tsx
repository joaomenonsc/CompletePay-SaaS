"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface ComparisonMetrics {
  conversas: number;
  resolucao: string;
  tempoMedio: string;
  csat: string;
  tokensDia: string;
  custoDia: string;
}

interface AnalyticsComparisonTableProps {
  currentAgentName: string;
  comparedAgentName: string;
  currentMetrics: ComparisonMetrics;
  comparedMetrics: ComparisonMetrics;
}

const METRIC_LABELS: { key: keyof ComparisonMetrics; label: string }[] = [
  { key: "conversas", label: "Conversas" },
  { key: "resolucao", label: "Resolução" },
  { key: "tempoMedio", label: "Tempo Médio" },
  { key: "csat", label: "CSAT" },
  { key: "tokensDia", label: "Tokens/dia" },
  { key: "custoDia", label: "Custo/dia" },
];

export function AnalyticsComparisonTable({
  currentAgentName,
  comparedAgentName,
  currentMetrics,
  comparedMetrics,
}: AnalyticsComparisonTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Comparação: {currentAgentName} vs {comparedAgentName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Métrica</TableHead>
              <TableHead>{currentAgentName}</TableHead>
              <TableHead>{comparedAgentName}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {METRIC_LABELS.map(({ key, label }) => (
              <TableRow key={key}>
                <TableCell className="font-medium text-muted-foreground">{label}</TableCell>
                <TableCell className="tabular-nums">{currentMetrics[key]}</TableCell>
                <TableCell className="tabular-nums">{comparedMetrics[key]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Métricas mock para comparação (em produção viriam da API por agente/período) */
export function getMockMetricsForAgent(_agentId: string, variant: "current" | "compared"): ComparisonMetrics {
  if (variant === "current") {
    return {
      conversas: 142,
      resolucao: "78%",
      tempoMedio: "1.8s",
      csat: "4.2",
      tokensDia: "45.230",
      custoDia: "$4.52",
    };
  }
  return {
    conversas: 89,
    resolucao: "92%",
    tempoMedio: "1.2s",
    csat: "4.5",
    tokensDia: "28.100",
    custoDia: "$2.81",
  };
}
