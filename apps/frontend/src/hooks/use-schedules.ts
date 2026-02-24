"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createSchedule, fetchSchedules } from "@/lib/api/calendar";

const SCHEDULES_QUERY_KEY = ["calendar-schedules"] as const;

export function useSchedules() {
  return useQuery({
    queryKey: SCHEDULES_QUERY_KEY,
    queryFn: fetchSchedules,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof createSchedule>[0]) => createSchedule(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
    },
  });
}
