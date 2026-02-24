"use client";

/**
 * Tela 3: layout de 2 colunas (BookingSummary | BookingForm).
 * Aparece quando ?slot= está na URL.
 * Tutorial: docs/calendario/paginas-publicas-booking-tutorial.md § 6.1
 */
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { toast } from "sonner";

import {
  createPublicBooking,
  fetchPublicProfile,
  fetchPublicSlots,
} from "@/lib/api/calendar-public";

import { BookingForm, type BookingFormData } from "./booking-form";
import { BookingSummary } from "./booking-summary";

export interface BookingFormViewProps {
  orgSlug: string;
  userSlug: string;
  eventSlug: string;
  selectedSlot: string;
}

export function BookingFormView({
  orgSlug,
  userSlug,
  eventSlug,
  selectedSlot,
}: BookingFormViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timezone = searchParams.get("tz") ?? "America/Sao_Paulo";

  // selectedSlot é "YYYY-MM-DDTHH:mm:00" (horário local na timezone do usuário)
  const slotDate = useMemo(() => {
    const d = new Date(selectedSlot);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [selectedSlot]);

  const monthStr = format(slotDate, "yyyy-MM");

  const { data: profile } = useQuery({
    queryKey: ["calendar-public-profile", orgSlug, userSlug],
    queryFn: () => fetchPublicProfile(orgSlug, userSlug),
    enabled: Boolean(orgSlug && userSlug),
  });

  const { data: slotsData } = useQuery({
    queryKey: ["calendar-public-slots", orgSlug, eventSlug, monthStr, timezone],
    queryFn: () => fetchPublicSlots(orgSlug, eventSlug, monthStr, timezone),
    enabled: Boolean(orgSlug && eventSlug && monthStr && timezone),
  });

  const eventTitle = slotsData?.eventType?.title ?? "Evento";
  const durationMinutes = slotsData?.eventType?.durationMinutes ?? 30;
  const displayName = profile?.orgName ?? profile?.hostName ?? "Host";
  const displayAvatarUrl = profile?.orgAvatarUrl ?? profile?.avatarUrl ?? null;
  const locationLabel =
    slotsData?.eventType?.locations?.[0]?.location_type === "video"
      ? "Vídeo"
      : slotsData?.eventType?.locations?.[0]?.location_type === "in_person"
        ? "Presencial"
        : slotsData?.eventType?.locations?.[0]?.location_type ?? "Vídeo";

  function handleBack() {
    router.back();
  }

  async function handleConfirm(formData: BookingFormData) {
    try {
      const booking = await createPublicBooking({
        org_slug: orgSlug,
        event_type_slug: eventSlug,
        guest_name: formData.name,
        guest_email: formData.email,
        guest_notes: formData.notes,
        start_time: selectedSlot,
        timezone,
        duration_minutes: durationMinutes,
      });
      toast.success("Agendamento realizado!");
      router.push(`/calendario/booking/${booking.uid}`);
    } catch (err: unknown) {
      const message =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { status?: number } }).response?.status === 409
          ? "Este horário não está mais disponível. Escolha outro."
          : "Não foi possível agendar. Tente novamente.";
      toast.error(message);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[280px_1fr] md:divide-x md:divide-border">
        <div className="border-b border-border p-6 md:border-b-0">
          <BookingSummary
            hostName={displayName}
            avatarUrl={displayAvatarUrl}
            eventTitle={eventTitle}
            durationMinutes={durationMinutes}
            locationLabel={locationLabel}
            timezone={timezone}
            slotDate={slotDate}
            onBack={handleBack}
          />
        </div>

        <div className="p-6">
          <BookingForm onSubmit={handleConfirm} />
        </div>
      </div>
    </div>
  );
}
