"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const topPerguntas = [
  { text: "Horário de funcionamento", count: 28 },
  { text: "Planos e preços", count: 22 },
  { text: "Status do pedido", count: 18 },
  { text: "Política de trocas", count: 15 },
  { text: "Suporte técnico", count: 12 },
];

export function AnalyticsTopPerguntas() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 Perguntas</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {topPerguntas.map((item, i) => (
            <li
              key={item.text}
              className="flex items-baseline justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium text-muted-foreground tabular-nums">{i + 1}. </span>
                {item.text}
              </span>
              <span className="shrink-0 text-muted-foreground tabular-nums">({item.count})</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
