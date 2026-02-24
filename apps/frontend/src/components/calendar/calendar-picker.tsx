"use client";

import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as React from "react";

import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export interface CalendarPickerProps {
  /** Datas que têm slots (YYYY-MM-DD) */
  availableDates: string[];
  /** Data selecionada */
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  /** Mês inicial (controlando navegação) */
  month?: Date;
  onMonthChange?: (month: Date) => void;
  /** Quando true e availableDates vazio, permite clicar em qualquer data (só desabilita passado) */
  allowAllDatesWhenEmpty?: boolean;
  className?: string;
  /** Formatters do DayPicker (ex.: formatWeekdayName para DOM. SEG.) */
  formatters?: { formatWeekdayName?: (date: Date) => string };
}

export function CalendarPicker({
  availableDates,
  selectedDate,
  onSelectDate,
  month,
  onMonthChange,
  allowAllDatesWhenEmpty = false,
  className,
  formatters,
}: CalendarPickerProps) {
  const availableSet = React.useMemo(
    () => new Set(availableDates),
    [availableDates]
  );

  const isEmpty = availableDates.length === 0;
  const canSelectAny = allowAllDatesWhenEmpty && isEmpty;

  const isDayDisabled = React.useCallback(
    (date: Date) => {
      const today = startOfDay(new Date());
      if (isBefore(date, today)) return true; // desabilita datas passadas
      if (canSelectAny) return false; // permite qualquer data futura
      const key = format(date, "yyyy-MM-dd");
      return !availableSet.has(key);
    },
    [availableSet, canSelectAny]
  );

  return (
    <Calendar
      mode="single"
      locale={ptBR}
      selected={selectedDate ?? undefined}
      onSelect={(d) => onSelectDate(d ?? null)}
      month={month}
      onMonthChange={onMonthChange}
      disabled={isDayDisabled}
      className={cn(className)}
      formatters={formatters}
    />
  );
}
