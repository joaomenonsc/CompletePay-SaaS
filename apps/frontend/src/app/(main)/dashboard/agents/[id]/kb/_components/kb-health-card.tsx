"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KbHealthCardProps {
  totalChunks?: number;
  status?: string;
  cobertura?: string;
  lastUpdate?: string;
}

export function KbHealthCard({
  totalChunks = 411,
  status = "Saudável",
  cobertura = "Boa",
  lastUpdate = "14/02 14:30",
}: KbHealthCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>KB Health</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-muted-foreground">Total de Chunks: </span>
          <span className="font-medium tabular-nums">{totalChunks}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Status: </span>
          <span className="font-medium text-green-600">{status}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Cobertura estimada: </span>
          <span className="font-medium">{cobertura}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Última atualização: </span>
          <span className="font-medium">{lastUpdate}</span>
        </span>
      </CardContent>
    </Card>
  );
}
