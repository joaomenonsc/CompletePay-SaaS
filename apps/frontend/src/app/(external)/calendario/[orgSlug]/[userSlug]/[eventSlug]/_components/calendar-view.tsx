"use client";

/**
 * Tela 2: layout de 3 colunas (EventInfo | CalendarGrid | TimeSlots).
 * Transição para Tela 3 via ?slot= na URL ao clicar em um horário.
 * Tutorial: docs/calendario/paginas-publicas-booking-tutorial.md § 4.2
 */
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Columns3,
  LayoutGrid,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  fetchPublicBookingByUid,
  fetchPublicProfile,
  fetchPublicSlots,
} from "@/lib/api/calendar-public";

import { CalendarGrid } from "./calendar-grid";
import { EventInfo } from "./event-info";
import { TimeSlots } from "./time-slots";

export interface CalendarViewProps {
  orgSlug: string;
  userSlug: string;
  eventSlug: string;
  rescheduleUid?: string;
}

export function CalendarView({
  orgSlug,
  userSlug,
  eventSlug,
  rescheduleUid,
}: CalendarViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [use24h, setUse24h] = useState(false);
  const [timezone, setTimezone] = useState(() => {
    if (
      typeof Intl !== "undefined" &&
      Intl.DateTimeFormat().resolvedOptions().timeZone
    ) {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    return "America/Sao_Paulo";
  });

  const monthStr = format(currentMonth, "yyyy-MM");
  const nextMonth = useMemo(() => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    return d;
  }, [currentMonth]);
  const nextMonthStr = format(nextMonth, "yyyy-MM");

  const { data: profile } = useQuery({
    queryKey: ["calendar-public-profile", orgSlug, userSlug],
    queryFn: () => fetchPublicProfile(orgSlug, userSlug),
    enabled: Boolean(orgSlug && userSlug),
  });

  const { data: previousBooking } = useQuery({
    queryKey: ["calendar-public-booking", rescheduleUid],
    queryFn: () => fetchPublicBookingByUid(rescheduleUid!),
    enabled: Boolean(rescheduleUid),
  });

  const { data: slotsData, isLoading: loadingSlots } = useQuery({
    queryKey: ["calendar-public-slots", orgSlug, eventSlug, monthStr, timezone],
    queryFn: () => fetchPublicSlots(orgSlug, eventSlug, monthStr, timezone),
    enabled: Boolean(orgSlug && eventSlug && monthStr && timezone),
  });

  const { data: nextSlotsData } = useQuery({
    queryKey: ["calendar-public-slots", orgSlug, eventSlug, nextMonthStr, timezone],
    queryFn: () => fetchPublicSlots(orgSlug, eventSlug, nextMonthStr, timezone),
    enabled: Boolean(orgSlug && eventSlug && nextMonthStr && timezone),
  });

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    slotsData?.days?.forEach((d) => set.add(d.date));
    nextSlotsData?.days?.forEach((d) => set.add(d.date));
    return set;
  }, [slotsData?.days, nextSlotsData?.days]);

  const slotsForSelectedDay = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const isNextMonth =
      selectedDate.getMonth() !== currentMonth.getMonth() ||
      selectedDate.getFullYear() !== currentMonth.getFullYear();
    const source = isNextMonth ? nextSlotsData : slotsData;
    if (!source?.days) return [];
    const day = source.days.find((d) => d.date === dateStr);
    return (day?.slots ?? []).map((s) => s.time);
  }, [selectedDate, currentMonth, slotsData?.days, nextSlotsData?.days]);

  // Seleciona o primeiro dia disponível quando os dados carregam
  useEffect(() => {
    if (loadingSlots || !slotsData?.days?.length || selectedDate !== null)
      return;
    const first = slotsData.days[0];
    if (first?.date) {
      const [y, m, d] = first.date.split("-").map(Number);
      setSelectedDate(new Date(y, m - 1, d));
    }
  }, [loadingSlots, slotsData?.days, selectedDate]);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    const dateMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const currentMonthStart = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    );
    if (dateMonth.getTime() !== currentMonthStart.getTime()) {
      setCurrentMonth(dateMonth);
    }
  }, [currentMonth]);

  const handleMonthChange = useCallback((direction: "prev" | "next") => {
    setSelectedDate(null);
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() + (direction === "next" ? 1 : -1));
      return newMonth;
    });
  }, []);

  const handleSlotSelect = useCallback(
    (time: string) => {
      if (!selectedDate) return;

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const startTime = `${dateStr}T${time}:00`;

      const params = new URLSearchParams(searchParams.toString());
      params.set("slot", startTime);
      params.set("tz", timezone);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [selectedDate, timezone, pathname, searchParams, router]
  );

  const eventTitle = slotsData?.eventType?.title ?? "Evento";
  const durationMinutes = slotsData?.eventType?.durationMinutes ?? 30;
  const displayName = profile?.orgName ?? profile?.hostName ?? "Host";
  const displayAvatarUrl = profile?.orgAvatarUrl ?? profile?.avatarUrl ?? null;
  const locationLabel =
    slotsData?.eventType?.locations?.[0]?.location_type === "video"
      ? "Cal Video"
      : slotsData?.eventType?.locations?.[0]?.location_type === "in_person"
        ? "Presencial"
        : slotsData?.eventType?.locations?.[0]?.location_type ?? "Cal Video";

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        {/* Header do card: Precisa de ajuda? + ícones de visualização */}
        <div className="flex justify-end gap-2 border-b border-zinc-800 p-4">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-0 bg-zinc-800 text-sm font-medium text-white shadow-none hover:bg-zinc-700 hover:text-white"
          >
            Precisa de ajuda?
          </Button>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-white hover:bg-zinc-800 hover:text-white"
              aria-label="Calendário"
            >
              <CalendarIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-white hover:bg-zinc-800 hover:text-white"
              aria-label="Grade"
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-white hover:bg-zinc-800 hover:text-white"
              aria-label="Colunas"
            >
              <Columns3 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-0 md:grid-cols-[240px_1fr_200px] md:divide-x md:divide-zinc-800">
          <div className="border-b border-zinc-800 p-6 md:border-b-0">
            <EventInfo
              hostName={displayName}
              avatarUrl={displayAvatarUrl}
              eventTitle={eventTitle}
              durationMinutes={durationMinutes}
              locationLabel={locationLabel}
              timezone={timezone}
              onTimezoneChange={setTimezone}
              previousBooking={previousBooking ?? undefined}
            />
          </div>

          <div className="border-b border-zinc-800 p-6 md:border-b-0">
            {loadingSlots ? (
              <div className="flex h-[280px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : slotsData && availableDates.size === 0 ? (
              <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center text-sm text-zinc-400">
                <p>Nenhum horário disponível neste mês.</p>
                <p className="text-xs text-zinc-500">
                  O host pode configurar a disponibilidade no painel.
                </p>
              </div>
            ) : (
              <CalendarGrid
                currentMonth={currentMonth}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                onMonthChange={handleMonthChange}
                availableDates={availableDates}
              />
            )}
          </div>

          <div className="p-6">
            <TimeSlots
              selectedDate={selectedDate}
              slots={slotsForSelectedDay}
              isLoading={loadingSlots}
              use24h={use24h}
              onUse24hChange={setUse24h}
              onSlotSelect={handleSlotSelect}
            />
          </div>
        </div>
      </div>
      <p className="mt-8 text-center text-sm text-zinc-500">CompletePay</p>
      </div>
    </div>
  );
}
