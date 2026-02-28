"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSchedule,
  fetchSchedule,
  fetchSchedules,
  updateSchedule,
} from "@/lib/api/calendar";

const SCHEDULES_QUERY_KEY = ["calendar-schedules"] as const;

export function useSchedules() {
  return useQuery({
    queryKey: SCHEDULES_QUERY_KEY,
    queryFn: fetchSchedules,
  });
}

/** Um schedule por ID (ex.: agenda do profissional). PRD 10.3: usar API do Calendário. */
export function useSchedule(scheduleId: string | null) {
  return useQuery({
    queryKey: [...SCHEDULES_QUERY_KEY, scheduleId],
    queryFn: () => fetchSchedule(scheduleId!),
    enabled: !!scheduleId,
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

/** Atualiza schedule (nome, timezone, intervalos). PRD 10.3. */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof updateSchedule>[1];
    }) => updateSchedule(id, body),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...SCHEDULES_QUERY_KEY, id] });
    },
  });
}
