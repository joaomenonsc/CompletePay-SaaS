"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchPublicSlots } from "@/lib/api/calendar-public";

export function useAvailableSlots(
  orgSlug: string,
  eventSlug: string,
  month: string,
  timezone: string,
  enabled = true
) {
  return useQuery({
    queryKey: ["calendar-public-slots", orgSlug, eventSlug, month, timezone],
    queryFn: () => fetchPublicSlots(orgSlug, eventSlug, month, timezone),
    enabled: enabled && Boolean(orgSlug && eventSlug && month && timezone),
  });
}
