/**
 * Utilitários puros para a visão de calendário de Reservas.
 * Sem side effects — testáveis com Vitest.
 */
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addDays,
  isSameMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Booking } from "@/types/calendar";

// ─── Agrupamento ────────────────────────────────────────────────────────────

/**
 * Agrupa bookings por data local (chave "YYYY-MM-DD").
 */
export function groupBookingsByDate(
  bookings: Booking[]
): Record<string, Booking[]> {
  const map: Record<string, Booking[]> = {};
  for (const b of bookings) {
    if (!b.startTime) continue;
    const key = format(new Date(b.startTime), "yyyy-MM-dd");
    if (!map[key]) map[key] = [];
    map[key].push(b);
  }
  return map;
}

// ─── Semana ──────────────────────────────────────────────────────────────────

/**
 * Retorna os 7 dias da semana que contém `date`.
 * Semana começa na segunda-feira (locale ptBR).
 */
export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { locale: ptBR });
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

// ─── Mês ─────────────────────────────────────────────────────────────────────

/**
 * Retorna todas as células do grid mensal (35 ou 42 células),
 * preenchendo semanas incompletas com dias do mês anterior/seguinte.
 */
export function getMonthCells(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { locale: ptBR });
  const gridEnd = endOfWeek(monthEnd, { locale: ptBR });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

/**
 * Verifica se uma célula pertence ao mês atual (para estilização).
 */
export function isCurrentMonth(day: Date, reference: Date): boolean {
  return isSameMonth(day, reference);
}

// ─── Hours grid ─────────────────────────────────────────────────────────────

/** Horas visíveis no grid de tempo (8h–20h). */
export const HOUR_SLOTS: number[] = Array.from({ length: 13 }, (_, i) => i + 8);

/**
 * Retorna a posição relativa (0–1) de um booking
 * dentro da janela de horas visível (HOUR_SLOTS[0] a HOUR_SLOTS[last] + 1h).
 * Usado para posicionamento absoluto/CSS em modo Semana/Dia.
 */
export function getBookingPosition(booking: Booking): {
  top: number; // 0–1 (percentual do container)
  height: number; // 0–1
} {
  const start = new Date(booking.startTime);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const durationHours = booking.durationMinutes / 60;

  const gridStart = HOUR_SLOTS[0];
  const gridEnd = HOUR_SLOTS[HOUR_SLOTS.length - 1] + 1;
  const gridSpan = gridEnd - gridStart;

  const top = Math.max(0, (startHour - gridStart) / gridSpan);
  const height = Math.min(durationHours / gridSpan, 1 - top);

  return { top, height };
}

// ─── Color helpers ────────────────────────────────────────────────────────────

/** Retorna classes Tailwind de cor para o booking pill conforme o status. */
export function getBookingPillClasses(status: Booking["status"]): string {
  switch (status) {
    case "confirmed":
      return "bg-primary/15 border-l-2 border-primary text-primary";
    case "pending":
      return "bg-amber-50 border-l-2 border-amber-400 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300";
    case "cancelled":
    case "no_show":
      return "bg-red-50 border-l-2 border-red-400 text-red-800 dark:bg-red-950/30 dark:text-red-300 line-through opacity-70";
    case "completed":
      return "bg-muted border-l-2 border-muted-foreground/30 text-muted-foreground";
    default:
      return "bg-muted border-l-2 border-border text-muted-foreground";
  }
}

// ─── Label helpers ────────────────────────────────────────────────────────────

/** Formata o label de período exibido no header do calendário. */
export function getPeriodLabel(
  subview: "day" | "week" | "month",
  date: Date
): string {
  switch (subview) {
    case "day":
      return format(date, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
    case "week": {
      const days = getWeekDays(date);
      const first = days[0];
      const last = days[6];
      if (isSameMonth(first, last)) {
        return `${format(first, "d")}–${format(last, "d 'de' MMMM yyyy", { locale: ptBR })}`;
      }
      return `${format(first, "d MMM", { locale: ptBR })} – ${format(last, "d MMM yyyy", { locale: ptBR })}`;
    }
    case "month":
      return format(date, "MMMM yyyy", { locale: ptBR });
  }
}
