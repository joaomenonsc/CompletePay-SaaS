/**
 * Página pública de booking — Server Component.
 * Tutorial: docs/calendario/paginas-publicas-booking-tutorial.md § 3.2
 */
import { BookingPageContent } from "./_components/booking-page-content";

interface Props {
  params: Promise<{ orgSlug: string; userSlug: string; eventSlug: string }>;
  searchParams: Promise<{ slot?: string }>;
}

export default async function BookingPage({ params, searchParams }: Props) {
  const { orgSlug, userSlug, eventSlug } = await params;
  const { slot } = await searchParams;

  return (
    <BookingPageContent
      orgSlug={orgSlug}
      userSlug={userSlug}
      eventSlug={eventSlug}
      initialSlot={slot}
    />
  );
}
