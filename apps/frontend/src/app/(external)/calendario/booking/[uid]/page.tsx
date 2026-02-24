"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublicBookingByUid } from "@/lib/api/calendar-public";
import { CalendarCheck } from "lucide-react";

export default function CalendarioBookingConfirmationPage() {
  const params = useParams();
  const uid = params.uid as string;

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ["calendar-public-booking", uid],
    queryFn: () => fetchPublicBookingByUid(uid),
    enabled: Boolean(uid),
  });

  if (error || (!isLoading && !booking)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <p className="text-destructive">Reserva não encontrada ou link inválido.</p>
        <Link href="/">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    );
  }

  if (isLoading || !booking) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-8">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const startDate = booking.startTime ? new Date(booking.startTime) : null;
  const endDate = booking.endTime ? new Date(booking.endTime) : null;

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="bg-primary/10 text-primary rounded-full p-3">
          <CalendarCheck className="size-8" />
        </div>
        <h1 className="text-2xl font-semibold">Agendamento confirmado</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{booking.eventTitle}</CardTitle>
          <CardDescription>
            com {booking.hostName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {startDate && endDate && (
            <p className="text-muted-foreground text-sm">
              {format(startDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              <br />
              {format(startDate, "HH:mm", { locale: ptBR })} –{" "}
              {format(endDate, "HH:mm", { locale: ptBR })} ({booking.timezone})
            </p>
          )}
          <p className="text-sm">
            <span className="text-muted-foreground">Convidado:</span> {booking.guestName} (
            {booking.guestEmail})
          </p>
          {booking.meetingUrl && (
            <a
              href={booking.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm"
            >
              Link da reunião
            </a>
          )}
          <p className="text-muted-foreground pt-2 text-xs">
            Status: {booking.status}
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Link href="/">
          <Button variant="outline">Voltar ao início</Button>
        </Link>
      </div>
    </div>
  );
}
