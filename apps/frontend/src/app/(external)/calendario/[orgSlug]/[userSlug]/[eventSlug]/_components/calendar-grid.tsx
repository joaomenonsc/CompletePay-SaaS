"use client";

/**
 * Coluna central da Tela 2: grid de dias do mês.
 * Tutorial: docs/calendario/paginas-publicas-booking-tutorial.md § 4.4
 */
import { useMemo } from "react";

import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."];
const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const MONTH_ABBR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export interface CalendarGridProps {
  currentMonth: Date;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onMonthChange: (direction: "prev" | "next") => void;
  availableDates?: Set<string>;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function generateCalendarWeeks(month: Date): Array<Array<Date | null>> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells: Array<Date | null> = [];

  // Células vazias antes do primeiro dia
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);

  // Dias do mês atual
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIndex, d);
    date.setHours(0, 0, 0, 0);
    cells.push(date);
  }

  // Preencher com dias do próximo mês até ter mínimo 35 células E completar a semana
  const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
  const nextYear = monthIndex === 11 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length < 35 || cells.length % 7 !== 0) {
    const date = new Date(nextYear, nextMonth, nextDay);
    date.setHours(0, 0, 0, 0);
    cells.push(date);
    nextDay++;
  }

  // Dividir em semanas de 7
  const weeks: Array<Array<Date | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}

function buildDayClasses({
  isSelected,
  isToday,
  isDisabled,
}: {
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
}): string {
  const base =
    "flex h-full w-full min-h-0 flex-col items-center justify-center gap-0.5 rounded-xl text-base font-medium transition-colors";

  // Datas indisponíveis: só texto apagado, sem caixa
  if (isDisabled)
    return cn(base, "cursor-not-allowed text-zinc-500 opacity-50");

  // Data selecionada: fundo branco, texto escuro (referência)
  if (isSelected)
    return cn(base, "!bg-white !text-zinc-900 !rounded-xl shadow-none");

  // Hoje (não selecionado): fill sutil
  if (isToday)
    return cn(
      base,
      "border-0 bg-zinc-800/60 text-white hover:bg-zinc-700/80 cursor-pointer"
    );

  // Datas disponíveis: fill sutil, sem borda (referência)
  return cn(
    base,
    "border-0 bg-zinc-800/60 text-zinc-100 hover:bg-zinc-700/80 cursor-pointer"
  );
}

export function CalendarGrid({
  currentMonth,
  selectedDate,
  onDateSelect,
  onMonthChange,
  availableDates,
}: CalendarGridProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const calendarWeeks = useMemo(() => {
    const weeks = generateCalendarWeeks(currentMonth);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 7);
    // Filtrar semanas onde nenhum dia >= cutoff
    return weeks.filter((week) =>
      week.some((day) => day !== null && day >= cutoff)
    );
  }, [currentMonth, today]);

  const isPrevDisabled = useMemo(() => {
    const lastDayOfPrevMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      0
    );
    return lastDayOfPrevMonth < today;
  }, [currentMonth, today]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[1rem] font-normal">
          <span className="text-white">
            {MONTH_NAMES[currentMonth.getMonth()]}
          </span>{" "}
          <span className="text-zinc-500">
            {currentMonth.getFullYear()}
          </span>
        </h2>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={() => onMonthChange("prev")}
            disabled={isPrevDisabled}
            className="rounded p-1.5 text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => onMonthChange("next")}
            className="rounded p-1.5 text-white hover:bg-zinc-800"
            aria-label="Próximo mês"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="pb-2 text-[0.75rem] font-medium uppercase tracking-wide text-zinc-400"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarWeeks.flatMap((week, weekIndex) =>
          week.map((day, dayIndex) => {
            const cellClasses = "aspect-square w-full min-h-0";

            if (!day)
              return (
                <div
                  key={`empty-${weekIndex}-${dayIndex}`}
                  className={cellClasses}
                  aria-hidden
                />
              );

            const currentMonthIndex = currentMonth.getMonth();
            const isFirstDayOfNextMonth =
              day.getMonth() !== currentMonthIndex && day.getDate() === 1;
            const monthAbbr = isFirstDayOfNextMonth
              ? MONTH_ABBR[day.getMonth()]
              : null;

            const dateKey = formatDateKey(day);
            const isToday = day.getTime() === today.getTime();
            const isSelected =
              selectedDate !== null && day.getTime() === selectedDate.getTime();
            const isPast = day < today;
            const hasAvailability = availableDates
              ? availableDates.has(dateKey)
              : !isPast;
            const isDisabled = isPast || !hasAvailability;

            return (
              <div key={dateKey} className={cellClasses}>
                <button
                  type="button"
                  onClick={() => !isDisabled && onDateSelect(day)}
                  disabled={isDisabled}
                  aria-label={`${day.getDate()} de ${MONTH_NAMES[day.getMonth()]}${isToday ? " (hoje)" : ""}`}
                  aria-pressed={isSelected}
                  className={cn(
                    buildDayClasses({ isSelected, isToday, isDisabled }),
                    "relative h-full w-full"
                  )}
                >
                  {monthAbbr && (
                    <span className="absolute left-1 top-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      {monthAbbr}
                    </span>
                  )}
                  <span>{day.getDate()}</span>
                  {isToday && (
                    <span
                      className="size-1 shrink-0 rounded-full bg-white"
                      aria-hidden
                    />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
