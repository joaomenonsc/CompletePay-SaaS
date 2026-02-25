"use client";

/**
 * Coluna esquerda da Tela 3: resumo do agendamento + botão Voltar.
 * Em modo reagendamento exibe "Horário anterior" e o novo horário.
 */
import { Calendar, Clock, Globe, Video } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { BookingPublic } from "@/types/calendar";

export interface BookingSummaryProps {
  hostName: string;
  avatarUrl: string | null;
  eventTitle: string;
  durationMinutes: number;
  locationLabel: string;
  timezone: string;
  slotDate: Date;
  onBack: () => void;
  /** Reserva anterior (em modo reagendamento). */
  previousBooking?: BookingPublic;
  /** Se true, exibe "Horário anterior" e "Novo horário". */
  isReschedule?: boolean;
}

export function BookingSummary({
  hostName,
  avatarUrl,
  eventTitle,
  durationMinutes,
  locationLabel,
  timezone,
  slotDate,
  onBack,
  previousBooking,
  isReschedule,
}: BookingSummaryProps) {
  const endDate = new Date(slotDate);
  endDate.setMinutes(endDate.getMinutes() + durationMinutes);

  const dateLabel = slotDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const startTime = slotDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const endTime = endDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const previousStart = previousBooking?.startTime
    ? new Date(previousBooking.startTime)
    : null;
  const previousEnd = previousBooking?.endTime
    ? new Date(previousBooking.endTime)
    : null;
  const previousDateLabel = previousStart
    ? previousStart.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const previousStartTime = previousStart
    ? previousStart.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;
  const previousEndTime = previousEnd
    ? previousEnd.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Voltar
      </button>

      <div className="flex items-center gap-3">
        <Avatar className="size-10 border border-border">
          <AvatarImage src={avatarUrl ?? undefined} alt={hostName} />
          <AvatarFallback className="bg-muted text-sm text-muted-foreground">
            {hostName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-semibold text-foreground">{hostName}</span>
      </div>

      <h1 className="text-xl font-bold text-foreground">{eventTitle}</h1>

      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        {isReschedule && previousDateLabel && previousStartTime && previousEndTime && (
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium text-foreground">Horário anterior</p>
              <p className="capitalize">{previousDateLabel}</p>
              <p>{previousStartTime}</p>
            </div>
          </div>
        )}
        <div className="flex items-start gap-2">
          <Calendar className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium text-foreground">
              {isReschedule ? "Novo horário" : dateLabel}
            </p>
            <p className={isReschedule ? undefined : ""}>
              {isReschedule ? (
                <>
                  <span className="capitalize">{dateLabel}</span>
                  <br />
                  {startTime} – {endTime}
                </>
              ) : (
                `${startTime} – ${endTime}`
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="size-4 shrink-0" />
          <span>{durationMinutes} min</span>
        </div>
        <div className="flex items-center gap-2">
          <Video className="size-4 shrink-0" />
          <span>{locationLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="size-4 shrink-0" />
          <span>{timezone.replace(/_/g, " ")}</span>
        </div>
      </div>
    </div>
  );
}
