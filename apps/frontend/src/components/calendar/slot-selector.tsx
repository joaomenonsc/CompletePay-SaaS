"use client";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface TimeSlot {
  time: string;
  durationMinutes: number;
}

export interface SlotSelectorProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  /** Formato 12h (e.g. "2:30 PM") ou 24h */
  use24h?: boolean;
  /** Layout: grid (padrão) ou list (lista vertical com indicador verde, para página pública) */
  variant?: "grid" | "list";
  className?: string;
}

function formatTime(timeStr: string, use24h: boolean): string {
  const [h, m] = timeStr.split(":").map(Number);
  if (use24h) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function SlotSelector({
  slots,
  selectedSlot,
  onSelectSlot,
  use24h = false,
  variant = "grid",
  className,
}: SlotSelectorProps) {
  if (slots.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Nenhum horário disponível neste dia.</p>
    );
  }

  if (variant === "list") {
    return (
      <ScrollArea className={cn("h-[240px]", className)}>
        <div className="flex flex-col gap-1 pr-4">
          {slots.map((slot) => {
            const isSelected =
              selectedSlot?.time === slot.time &&
              selectedSlot?.durationMinutes === slot.durationMinutes;
            return (
              <button
                key={`${slot.time}-${slot.durationMinutes}`}
                type="button"
                onClick={() => onSelectSlot(slot)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  isSelected
                    ? "border-zinc-500 bg-white text-zinc-900"
                    : "border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800"
                )}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                {formatTime(slot.time, use24h)}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className={cn("h-[240px]", className)}>
      <div className="grid grid-cols-3 gap-2 pr-4 sm:grid-cols-4">
        {slots.map((slot) => {
          const isSelected =
            selectedSlot?.time === slot.time &&
            selectedSlot?.durationMinutes === slot.durationMinutes;
          return (
            <Button
              key={`${slot.time}-${slot.durationMinutes}`}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectSlot(slot)}
            >
              {formatTime(slot.time, use24h)}
            </Button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
