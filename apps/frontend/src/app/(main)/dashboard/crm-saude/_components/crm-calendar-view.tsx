"use client";

import { useMemo } from "react";
import { CalendarView } from "../../calendario/reservas/_components/calendar-view";
import type { AppointmentListItem } from "@/types/crm";
import type { Booking } from "@/types/calendar";

// ─── Status mapping ───────────────────────────────────────────────────────────

function mapStatus(status: string): Booking["status"] {
    const s = (status ?? "").toLowerCase();
    if (s === "confirmado" || s === "em_atendimento") return "confirmed";
    if (s === "agendado") return "pending";
    if (s === "atendido") return "completed";
    if (s === "no_show") return "no_show";
    if (s === "cancelado") return "cancelled";
    return "pending";
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

function toBooking(a: AppointmentListItem): Booking {
    const start = new Date(a.start_time);
    const end = new Date(a.end_time);
    const durationMinutes = Math.max(
        15,
        Math.round((end.getTime() - start.getTime()) / 60_000)
    );

    return {
        id: a.id,
        uid: a.id,
        eventTypeId: "crm",
        hostUserId: a.professional_id,
        hostAgentConfigId: null,
        guestName: a.patient_name ?? "Paciente",
        guestEmail: "",
        guestNotes: null,
        startTime: a.start_time,
        endTime: a.end_time,
        durationMinutes,
        timezone: "America/Sao_Paulo",
        status: mapStatus(a.status),
        cancellationReason: null,
        cancelledBy: null,
        meetingUrl: null,
        rescheduledFrom: null,
        createdAt: a.start_time,
        updatedAt: a.start_time,
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CrmCalendarViewProps {
    appointments: AppointmentListItem[];
    onAppointmentClick: (appointment: AppointmentListItem) => void;
}

export function CrmCalendarView({
    appointments,
    onAppointmentClick,
}: CrmCalendarViewProps) {
    const bookings = useMemo(
        () => appointments.map(toBooking),
        [appointments]
    );

    // Build id → appointment map for click-back lookups
    const appointmentMap = useMemo(() => {
        const map = new Map<string, AppointmentListItem>();
        for (const a of appointments) map.set(a.id, a);
        return map;
    }, [appointments]);

    return (
        <CalendarView
            bookings={bookings}
            eventTypes={[]}
            onBookingClick={(booking) => {
                const appt = appointmentMap.get(booking.id);
                if (appt) onAppointmentClick(appt);
            }}
        />
    );
}
