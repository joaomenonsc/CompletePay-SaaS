"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { fetchBookings } from "@/lib/api/calendar";

export default function ReservasPage() {
  const { data: bookings, isLoading, error } = useQuery({
    queryKey: ["calendar-bookings"],
    queryFn: () => fetchBookings({ limit: 50 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reservas</h1>
        <p className="text-muted-foreground text-sm">
          Lista de agendamentos realizados.
        </p>
      </div>

      {error && (
        <p className="text-destructive text-sm">Erro ao carregar reservas.</p>
      )}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : bookings?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-5" />
              Últimas reservas
            </CardTitle>
            <CardDescription>Confirmadas, pendentes e concluídas</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div>
                    <p className="font-medium">{b.guestName}</p>
                    <p className="text-muted-foreground text-sm">{b.guestEmail}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {b.startTime ? format(new Date(b.startTime), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                    </p>
                  </div>
                  <Badge variant={b.status === "confirmed" ? "default" : "secondary"}>
                    {b.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="text-muted-foreground mb-4 size-12" />
            <p className="text-muted-foreground text-sm">Nenhuma reserva ainda.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
