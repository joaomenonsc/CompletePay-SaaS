"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartData = [
  { day: "Seg", conversas: 18, resolucao: 72 },
  { day: "Ter", conversas: 22, resolucao: 75 },
  { day: "Qua", conversas: 20, resolucao: 78 },
  { day: "Qui", conversas: 25, resolucao: 74 },
  { day: "Sex", conversas: 28, resolucao: 80 },
  { day: "Sab", conversas: 12, resolucao: 70 },
  { day: "Dom", conversas: 8, resolucao: 68 },
];

const chartConfig = {
  day: { label: "Dia" },
  conversas: {
    label: "Conversas",
    color: "var(--chart-1)",
  },
  resolucao: {
    label: "Resolução (%)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function AnalyticsChartConversas() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Conversas por Dia</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-62 w-full">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillConversas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-conversas)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-conversas)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillResolucao" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-resolucao)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-resolucao)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area dataKey="conversas" type="natural" fill="url(#fillConversas)" stroke="var(--color-conversas)" />
            <Area dataKey="resolucao" type="natural" fill="url(#fillResolucao)" stroke="var(--color-resolucao)" />
          </AreaChart>
        </ChartContainer>
        <div className="mt-3 flex flex-wrap gap-6 text-muted-foreground text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-full" style={{ backgroundColor: "var(--chart-1)" }} />
            Conversas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-full" style={{ backgroundColor: "var(--chart-2)" }} />
            Resolução (%)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
