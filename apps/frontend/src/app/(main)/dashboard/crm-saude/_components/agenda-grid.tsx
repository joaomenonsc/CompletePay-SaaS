"use client";

import React, { useMemo } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AppointmentListItem } from "@/types/crm";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  agendado: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  confirmado: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  em_atendimento: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  atendido: "bg-muted text-muted-foreground",
  no_show: "bg-destructive/10 text-destructive border-destructive/20",
  cancelado: "bg-muted text-muted-foreground line-through",
};

const SLOT_START = 8;
const SLOT_END = 19;
const SLOT_STEP_MINUTES = 30;

function buildSlotKeys(date: Date): string[] {
  const keys: string[] = [];
  const base = new Date(date);
  base.setHours(SLOT_START, 0, 0, 0);
  const end = new Date(date);
  end.setHours(SLOT_END, 0, 0, 0);
  while (base < end) {
    keys.push(format(base, "HH:mm"));
    base.setMinutes(base.getMinutes() + SLOT_STEP_MINUTES);
  }
  return keys;
}

function appointmentToSlotKey(startTime: string): string {
  const d = new Date(startTime);
  const minutes = d.getMinutes();
  const rounded = minutes < 30 ? 0 : 30;
  d.setMinutes(rounded, 0, 0);
  return format(d, "HH:mm");
}

function appointmentToDateKey(startTime: string): string {
  return format(new Date(startTime), "yyyy-MM-dd");
}

interface AgendaGridProps {
  viewMode: "day" | "week";
  currentDate: Date;
  appointments: AppointmentListItem[];
  onSlotClick?: (date: Date, slotTime: string) => void;
  onAppointmentClick?: (appointment: AppointmentListItem) => void;
}

export function AgendaGrid({
  viewMode,
  currentDate,
  appointments,
  onSlotClick,
  onAppointmentClick,
}: AgendaGridProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = useMemo(() => {
    if (viewMode === "day") {
      return [currentDate];
    }
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [viewMode, currentDate, weekStart]);

  const slotTimes = useMemo(() => buildSlotKeys(currentDate), [currentDate]);

  const appointmentsByKey = useMemo(() => {
    const map = new Map<string, AppointmentListItem>();
    for (const a of appointments) {
      const dateKey = appointmentToDateKey(a.start_time);
      const slotKey = appointmentToSlotKey(a.start_time);
      map.set(`${dateKey}-${slotKey}`, a);
    }
    return map;
  }, [appointments]);

  return (
    <ScrollArea className="h-[calc(100vh-16rem)] rounded-md border">
      <div className="min-w-[600px] p-4">
        <div className="grid gap-px" style={{
          gridTemplateColumns: `80px repeat(${days.length}, minmax(140px, 1fr))`,
        }}>
          <div className="bg-muted/50 p-2 text-muted-foreground text-xs font-medium" />
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className="bg-muted/50 p-2 text-center text-muted-foreground text-xs font-medium"
            >
              {format(d, "EEE d/M", { locale: ptBR })}
            </div>
          ))}
          {slotTimes.map((slotTime) => (
            <React.Fragment key={slotTime}>
              <div className="bg-muted/30 p-1 text-right text-muted-foreground text-xs">
                {slotTime}
              </div>
              {days.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const key = `${dateKey}-${slotTime}`;
                const appointment = appointmentsByKey.get(key);
                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-[52px] border border-transparent p-1",
                      !appointment && "hover:bg-muted/50 cursor-pointer"
                    )}
                    onClick={() => {
                      if (appointment) {
                        onAppointmentClick?.(appointment);
                      } else {
                        const [h, m] = slotTime.split(":").map(Number);
                        const slotDate = new Date(day);
                        slotDate.setHours(h, m, 0, 0);
                        onSlotClick?.(slotDate, slotTime);
                      }
                    }}
                  >
                    {appointment && (
                      <Card
                        className={cn(
                          "cursor-pointer border transition-colors hover:bg-muted/50",
                          STATUS_CLASS[(appointment.status ?? "").toLowerCase()] ?? "border-border"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAppointmentClick?.(appointment);
                        }}
                      >
                        <CardContent className="p-2">
                          <p className="truncate text-sm font-medium">
                            {appointment.patient_name ?? appointment.patient_id}
                          </p>
                          <p className="text-muted-foreground truncate text-xs capitalize">
                            {appointment.appointment_type}
                          </p>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "mt-1 text-[10px]",
                              STATUS_CLASS[(appointment.status ?? "").toLowerCase()]
                            )}
                          >
                            {appointment.status}
                          </Badge>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
