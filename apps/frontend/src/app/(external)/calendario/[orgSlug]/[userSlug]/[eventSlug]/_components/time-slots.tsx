"use client";

/**
 * Coluna direita da Tela 2: dia selecionado + toggle 12h/24h + lista de horários (outline).
 * Correções: docs/calendario/correcoes-design-tela2-booking.md § 10, § 11
 */
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export interface TimeSlotsProps {
  selectedDate: Date | null;
  slots: string[];
  isLoading: boolean;
  use24h?: boolean;
  onUse24hChange?: (value: boolean) => void;
  onSlotSelect: (time: string) => void;
}

function formatSlotTime(time: string, use24h: boolean): string {
  const [h, m] = time.split(":").map(Number);
  if (use24h) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function TimeSlots({
  selectedDate,
  slots,
  isLoading,
  use24h = false,
  onUse24hChange,
  onSlotSelect,
}: TimeSlotsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [selectedDate]);

  if (!selectedDate) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center">
        <p className="text-sm text-zinc-400">Selecione um dia</p>
      </div>
    );
  }

  const DAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const dayLabel = `${DAYS_SHORT[selectedDate.getDay()]}. ${selectedDate.getDate()}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="whitespace-nowrap text-sm font-medium text-white">
          {dayLabel}
        </h3>
        {onUse24hChange && (
          <div className="flex rounded-md border border-zinc-700/50 p-0.5">
            <button
              type="button"
              onClick={() => onUse24hChange(false)}
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors",
                !use24h
                  ? "bg-white text-zinc-900"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              12h
            </button>
            <button
              type="button"
              onClick={() => onUse24hChange(true)}
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors",
                use24h
                  ? "bg-white text-zinc-900"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              24h
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-9 animate-pulse rounded-lg bg-zinc-800"
              aria-hidden
            />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <p className="text-sm text-zinc-400">Nenhum horário disponível</p>
      ) : (
        <div
          ref={listRef}
          className="flex max-h-[400px] flex-col gap-2 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slots.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => onSlotSelect(time)}
              aria-label={`Agendar às ${formatSlotTime(time, use24h)}`}
              className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-transparent px-3 py-2.5 text-left text-[0.875rem] text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
            >
              <span
                className="size-2 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
              />
              {formatSlotTime(time, use24h)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
