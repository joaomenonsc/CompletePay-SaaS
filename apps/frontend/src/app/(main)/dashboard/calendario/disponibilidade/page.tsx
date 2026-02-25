"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSchedules } from "@/lib/api/calendar";

export default function DisponibilidadePage() {
  const { data: schedules, isLoading, error } = useQuery({
    queryKey: ["calendar-schedules"],
    queryFn: fetchSchedules,
  });

  return (
    <main className="space-y-6" role="main" aria-label="Disponibilidade">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Disponibilidade</h1>
          <p className="text-muted-foreground text-sm">
            Schedules e intervalos de horário disponível.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/calendario/disponibilidade/novo">
            <Plus className="mr-2 size-4" />
            Novo schedule
          </Link>
        </Button>
      </header>

      {error && (
        <p className="text-destructive text-sm" role="alert">Erro ao carregar schedules.</p>
      )}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : schedules?.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {schedules.map((s) => (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="size-4" />
                  {s.name}
                </CardTitle>
                {s.isDefault && (
                  <span className="text-muted-foreground text-xs">Padrão</span>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">Timezone: {s.timezone}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {s.intervals?.length ?? 0} intervalo(s) por semana
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href={`/dashboard/calendario/disponibilidade/${s.id}/editar`}>
                    Editar
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="text-muted-foreground mb-4 size-12" />
            <p className="text-muted-foreground mb-4 text-sm">Nenhum schedule configurado.</p>
            <Button asChild>
              <Link href="/dashboard/calendario/disponibilidade/novo">
                <Plus className="mr-2 size-4" />
                Criar primeiro schedule
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
