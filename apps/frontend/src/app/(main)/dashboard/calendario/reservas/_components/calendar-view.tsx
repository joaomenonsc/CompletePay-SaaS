"use client";

import { useState, useMemo } from "react";
import {
    addDays,
    addMonths,
    addWeeks,
    format,
    isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { Booking, EventType } from "@/types/calendar";
import {
    getBookingPillClasses,
    getBookingPosition,
    getMonthCells,
    getPeriodLabel,
    getWeekDays,
    groupBookingsByDate,
    HOUR_SLOTS,
    isCurrentMonth,
} from "../_utils/calendar-view-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Subview = "day" | "week" | "month";

interface CalendarViewProps {
    bookings: Booking[];
    eventTypes: EventType[];
    onBookingClick: (booking: Booking) => void;
}

// ─── Booking Pill ─────────────────────────────────────────────────────────────

function BookingPill({
    booking,
    compact = false,
    onClick,
}: {
    booking: Booking;
    compact?: boolean;
    onClick: () => void;
}) {
    const pillClasses = getBookingPillClasses(booking.status);
    const time = booking.startTime
        ? format(new Date(booking.startTime), "HH:mm")
        : "";

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={`Reserva de ${booking.guestName} às ${time}`}
            className={cn(
                "w-full cursor-pointer rounded px-1 py-0.5 text-left text-xs leading-tight transition-opacity hover:opacity-80",
                pillClasses
            )}
        >
            {!compact && (
                <span className="block truncate font-medium">{booking.guestName}</span>
            )}
            <span className="block truncate opacity-80">{time}</span>
        </button>
    );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
    currentDate,
    grouped,
    onBookingClick,
}: {
    currentDate: Date;
    grouped: Record<string, Booking[]>;
    onBookingClick: (b: Booking) => void;
}) {
    const cells = useMemo(() => getMonthCells(currentDate), [currentDate]);
    // Abbreviated on small screens, full on larger
    // ptBR locale: weeks start on Sunday (Dom)
    const weekDayNames = ["D", "S", "T", "Q", "Q", "S", "S"];
    const weekDayNamesLg = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    return (
        <div className="flex flex-1 flex-col min-h-0 overflow-auto">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b shrink-0">
                {weekDayNames.map((d, i) => (
                    <div
                        key={`${d}-${i}`}
                        className="py-2 text-center text-xs font-medium text-muted-foreground select-none"
                    >
                        <span className="sm:hidden">{d}</span>
                        <span className="hidden sm:inline">{weekDayNamesLg[i]}</span>
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 flex-1 divide-x divide-y border-b">
                {cells.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayBookings = grouped[key] ?? [];
                    const isOut = !isCurrentMonth(day, currentDate);
                    const todayClass = isToday(day);
                    const MAX_VISIBLE = 2;
                    const visible = dayBookings.slice(0, MAX_VISIBLE);
                    const overflow = dayBookings.length - MAX_VISIBLE;

                    return (
                        <div
                            key={key}
                            className={cn(
                                "min-h-[72px] p-1 text-sm sm:min-h-[90px] sm:p-1.5",
                                isOut && "bg-muted/30"
                            )}
                        >
                            {/* Day number */}
                            <div
                                className={cn(
                                    "mb-1 flex size-5 items-center justify-center rounded-full text-[11px] font-medium select-none sm:size-6 sm:text-xs",
                                    todayClass && "bg-primary text-primary-foreground",
                                    !todayClass && isOut && "text-muted-foreground/50",
                                    !todayClass && !isOut && "text-foreground"
                                )}
                            >
                                {format(day, "d")}
                            </div>

                            {/* Booking pills */}
                            <div className="flex flex-col gap-0.5">
                                {visible.map((b) => (
                                    <BookingPill
                                        key={b.id}
                                        booking={b}
                                        compact
                                        onClick={() => onBookingClick(b)}
                                    />
                                ))}
                                {overflow > 0 && (
                                    <span className="pl-0.5 text-[10px] text-muted-foreground">
                                        +{overflow}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Week / Day View ──────────────────────────────────────────────────────────

const CELL_HEIGHT_PX = 56; // pixels per hour slot (slightly shorter = denser)

function TimeGrid({
    days,
    grouped,
    onBookingClick,
}: {
    days: Date[];
    grouped: Record<string, Booking[]>;
    onBookingClick: (b: Booking) => void;
}) {
    const GRID_HEIGHT = HOUR_SLOTS.length * CELL_HEIGHT_PX;
    const COL_MIN_W = 100; // minimum px width per day column

    return (
        <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Hour labels column — compact */}
            <div className="w-10 shrink-0 border-r sm:w-12">
                <div className="border-b bg-background" style={{ height: 40 }} aria-hidden />
                <div className="relative" style={{ height: GRID_HEIGHT }}>
                    {HOUR_SLOTS.map((h) => (
                        <div
                            key={h}
                            className="absolute right-1 text-[10px] text-muted-foreground select-none sm:right-2 sm:text-[11px]"
                            style={{ top: (h - HOUR_SLOTS[0]) * CELL_HEIGHT_PX - 8 }}
                        >
                            {`${String(h).padStart(2, "0")}h`}
                        </div>
                    ))}
                </div>
            </div>

            {/* Day columns — horizontally scrollable with native overflow */}
            {/* min-w-0 is critical: without it, flex-1 can't shrink below child minWidth (700px) */}
            <div
                className="min-w-0 flex-1 overflow-x-auto"
                style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
            >
                <div
                    className="flex h-full"
                    style={{
                        minWidth: days.length === 1 ? "100%" : days.length * COL_MIN_W,
                    }}
                >
                    {days.map((day) => {
                        const key = format(day, "yyyy-MM-dd");
                        const dayBookings = grouped[key] ?? [];
                        const todayStyle = isToday(day);

                        return (
                            <div
                                key={key}
                                className="flex min-w-0 flex-1 flex-col border-r last:border-r-0"
                                style={{ minWidth: days.length === 1 ? "100%" : COL_MIN_W }}
                            >
                                {/* Day header */}
                                <div
                                    className="sticky top-0 z-10 flex flex-col items-center justify-center border-b bg-background py-1"
                                    style={{ height: 40 }}
                                >
                                    <span className="select-none text-[10px] font-medium uppercase text-muted-foreground sm:text-[11px]">
                                        {format(day, "EEE", { locale: ptBR })}
                                    </span>
                                    <span
                                        className={cn(
                                            "flex size-5 items-center justify-center rounded-full text-xs font-semibold select-none sm:size-6 sm:text-sm",
                                            todayStyle
                                                ? "bg-primary text-primary-foreground"
                                                : "text-foreground"
                                        )}
                                    >
                                        {format(day, "d")}
                                    </span>
                                </div>

                                {/* Hour grid */}
                                <div className="relative" style={{ height: GRID_HEIGHT }}>
                                    {HOUR_SLOTS.map((h) => (
                                        <div
                                            key={h}
                                            className="absolute inset-x-0 border-t border-border/50"
                                            style={{ top: (h - HOUR_SLOTS[0]) * CELL_HEIGHT_PX }}
                                            aria-hidden
                                        />
                                    ))}

                                    {dayBookings.map((b) => {
                                        const { top, height } = getBookingPosition(b);
                                        const pillClasses = getBookingPillClasses(b.status);
                                        const topPx = top * GRID_HEIGHT;
                                        const heightPx = Math.max(height * GRID_HEIGHT, 20);

                                        return (
                                            <button
                                                key={b.id}
                                                type="button"
                                                onClick={() => onBookingClick(b)}
                                                aria-label={`Reserva de ${b.guestName} às ${format(new Date(b.startTime), "HH:mm")}`}
                                                className={cn(
                                                    "absolute inset-x-0.5 cursor-pointer overflow-hidden rounded px-1 py-0.5 text-left text-xs transition-opacity hover:opacity-80",
                                                    pillClasses
                                                )}
                                                style={{ top: topPx, height: heightPx }}
                                            >
                                                <span className="block truncate font-medium leading-tight">
                                                    {b.guestName}
                                                </span>
                                                {heightPx >= 36 && (
                                                    <span className="block truncate leading-tight opacity-80">
                                                        {format(new Date(b.startTime), "HH:mm")}
                                                        {" – "}
                                                        {format(new Date(b.endTime), "HH:mm")}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CalendarView({
    bookings,
    eventTypes: _eventTypes,
    onBookingClick,
}: CalendarViewProps) {
    const [subview, setSubview] = useState<Subview>("week");
    const [currentDate, setCurrentDate] = useState(new Date());

    const grouped = useMemo(() => groupBookingsByDate(bookings), [bookings]);

    const [miniSelected, setMiniSelected] = useState<Date | undefined>(new Date());

    const gridDays = useMemo(() => {
        if (subview === "day") return [currentDate];
        if (subview === "week") return getWeekDays(currentDate);
        return [];
    }, [subview, currentDate]);

    const periodLabel = getPeriodLabel(subview, currentDate);

    function navigate(direction: 1 | -1) {
        if (subview === "day") {
            setCurrentDate((d) => addDays(d, direction));
        } else if (subview === "week") {
            setCurrentDate((d) => addWeeks(d, direction));
        } else {
            setCurrentDate((d) => addMonths(d, direction));
        }
    }

    function handleMiniSelect(date: Date | undefined) {
        if (!date) return;
        setMiniSelected(date);
        setCurrentDate(date);
    }

    const bookedDates = useMemo(
        () => Object.keys(grouped).map((k) => new Date(`${k}T00:00:00`)),
        [grouped]
    );

    return (
        <div className="flex gap-3 min-h-0" style={{ minHeight: 560 }}>
            {/* ── Left: mini-calendar — only on xl screens (wide enough with sidebar) ── */}
            <aside className="hidden xl:flex xl:flex-col xl:w-52 shrink-0 gap-3 min-w-0 overflow-hidden">
                <div className="overflow-hidden rounded-md border shadow-sm">
                    <Calendar
                        mode="single"
                        selected={miniSelected}
                        onSelect={handleMiniSelect}
                        locale={ptBR}
                        className="w-full p-2 [&_table]:w-full"
                        modifiers={{ hasBookings: bookedDates }}
                        modifiersClassNames={{
                            hasBookings:
                                "after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-primary relative",
                        }}
                    />
                </div>
            </aside>

            {/* ── Right: main calendar grid ── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
                {/* Header: navigation + subview toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 shrink-0">
                    {/* Period navigation */}
                    <div className="flex items-center gap-0.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => navigate(-1)}
                            aria-label="Período anterior"
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => navigate(1)}
                            aria-label="Próximo período"
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                        <h2 className="ml-1 text-sm font-semibold capitalize select-none">
                            {periodLabel}
                        </h2>
                    </div>

                    {/* Today button + Subview toggle */}
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                                setCurrentDate(new Date());
                                setMiniSelected(new Date());
                            }}
                        >
                            Hoje
                        </Button>

                        <div
                            className="flex rounded-md border bg-muted/40 p-0.5 gap-0.5"
                            role="group"
                            aria-label="Modo de visualização"
                        >
                            {(["day", "week", "month"] as const).map((sv) => (
                                <button
                                    key={sv}
                                    type="button"
                                    onClick={() => setSubview(sv)}
                                    aria-pressed={subview === sv}
                                    className={cn(
                                        "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                                        subview === sv
                                            ? "bg-background shadow-sm text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {sv === "day" ? "Dia" : sv === "week" ? "Semana" : "Mês"}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Grid content */}
                {subview === "month" ? (
                    <MonthView
                        currentDate={currentDate}
                        grouped={grouped}
                        onBookingClick={onBookingClick}
                    />
                ) : (
                    <TimeGrid
                        days={gridDays}
                        grouped={grouped}
                        onBookingClick={onBookingClick}
                    />
                )}
            </div>
        </div>
    );
}
