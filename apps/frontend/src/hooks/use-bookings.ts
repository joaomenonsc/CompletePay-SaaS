"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchBookings } from "@/lib/api/calendar";

const BOOKINGS_QUERY_KEY = ["calendar-bookings"] as const;

export function useBookings(params?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: [...BOOKINGS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchBookings(params),
  });
}
