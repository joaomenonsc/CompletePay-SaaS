"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const canaisData = [
  { name: "Chat Widget", pct: 63 },
  { name: "WhatsApp", pct: 28 },
  { name: "Email", pct: 9 },
];

export function AnalyticsCanais() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gráfico: Canais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canaisData.map((c) => (
          <div key={c.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{c.name}</span>
              <span className="text-muted-foreground tabular-nums">{c.pct}%</span>
            </div>
            <Progress value={c.pct} className="h-2" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
