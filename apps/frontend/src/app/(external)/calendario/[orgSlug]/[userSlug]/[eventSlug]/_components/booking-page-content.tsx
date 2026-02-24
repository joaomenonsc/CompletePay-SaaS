"use client";

/**
 * Decisor: exibe Tela 2 (calendário + horários) ou Tela 3 (formulário)
 * conforme a presença do query param ?slot= na URL.
 * Tutorial: docs/calendario/paginas-publicas-booking-tutorial.md § 4.1
 */
import { useSearchParams } from "next/navigation";

import { BookingFormView } from "./booking-form-view";
import { CalendarView } from "./calendar-view";

interface Props {
  orgSlug: string;
  userSlug: string;
  eventSlug: string;
  initialSlot?: string;
}

export function BookingPageContent({
  orgSlug,
  userSlug,
  eventSlug,
  initialSlot,
}: Props) {
  const searchParams = useSearchParams();
  const selectedSlot = searchParams.get("slot") ?? initialSlot;
  const isFormView = Boolean(selectedSlot);

  if (isFormView && selectedSlot) {
    return (
      <BookingFormView
        orgSlug={orgSlug}
        userSlug={userSlug}
        eventSlug={eventSlug}
        selectedSlot={selectedSlot}
      />
    );
  }

  return (
    <CalendarView
      orgSlug={orgSlug}
      userSlug={userSlug}
      eventSlug={eventSlug}
    />
  );
}
