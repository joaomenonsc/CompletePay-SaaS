"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const KPI_GRID_CLASS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 *:data-[slot=card]:shadow-xs *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:bg-linear-to-t dark:*:data-[slot=card]:bg-card";

function TrendBadge({ value, variant = "neutral" }: { value: string; variant?: "up" | "down" | "neutral" }) {
  const Icon = variant === "up" ? TrendingUp : variant === "down" ? TrendingDown : Minus;
  return (
    <Badge variant="outline" className="gap-0.5 font-normal">
      <Icon className="size-3" />
      {value}
    </Badge>
  );
}

const kpisRow1 = [
  {
    description: "Conversas",
    value: "142",
    trend: "+12%",
    trendVariant: "up" as const,
  },
  {
    description: "Taxa Resolução",
    value: "78%",
    trend: "+5%",
    trendVariant: "up" as const,
  },
  {
    description: "Tempo médio Resposta",
    value: "1.8s",
    trend: "-0.3s",
    trendVariant: "down" as const,
  },
  {
    description: "CSAT",
    value: "4.2/5",
    trend: "0%",
    trendVariant: "neutral" as const,
  },
];

const kpisRow2 = [
  {
    description: "Tokens Consumidos",
    value: "45.230",
    trend: "+18%",
    trendVariant: "up" as const,
  },
  {
    description: "Custo Estimado",
    value: "$4.52",
    trend: "+15%",
    trendVariant: "up" as const,
  },
];

export function AnalyticsKpiCards() {
  return (
    <div className="space-y-4">
      <div className={KPI_GRID_CLASS}>
        {kpisRow1.map((k) => (
          <Card key={k.description} className="@container/card">
            <CardHeader>
              <CardDescription>{k.description}</CardDescription>
              <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">{k.value}</CardTitle>
              <CardAction>
                <TrendBadge value={k.trend} variant={k.trendVariant} />
              </CardAction>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className={`${KPI_GRID_CLASS} lg:grid-cols-2`}>
        {kpisRow2.map((k) => (
          <Card key={k.description} className="@container/card">
            <CardHeader>
              <CardDescription>{k.description}</CardDescription>
              <CardTitle className="font-semibold @[250px]/card:text-3xl text-2xl tabular-nums">{k.value}</CardTitle>
              <CardAction>
                <TrendBadge value={k.trend} variant={k.trendVariant} />
              </CardAction>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
