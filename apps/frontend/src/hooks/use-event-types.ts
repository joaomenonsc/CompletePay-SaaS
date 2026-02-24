"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createEventType,
  deleteEventType,
  fetchEventType,
  fetchEventTypes,
  toggleEventType,
  updateEventType,
} from "@/lib/api/calendar";
import type { EventType } from "@/types/calendar";

const EVENT_TYPES_QUERY_KEY = ["event-types"] as const;
const EVENT_TYPE_QUERY_KEY = (id: string) => ["event-type", id] as const;

export function useEventTypes() {
  return useQuery({
    queryKey: EVENT_TYPES_QUERY_KEY,
    queryFn: fetchEventTypes,
  });
}

export function useEventType(id: string | null) {
  return useQuery({
    queryKey: EVENT_TYPE_QUERY_KEY(id ?? ""),
    queryFn: () => fetchEventType(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useCreateEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof createEventType>[0]) => createEventType(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENT_TYPES_QUERY_KEY });
    },
  });
}

export function useUpdateEventType(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => updateEventType(id, body),
    onSuccess: (data: EventType) => {
      queryClient.invalidateQueries({ queryKey: EVENT_TYPES_QUERY_KEY });
      queryClient.setQueryData(EVENT_TYPE_QUERY_KEY(data.id), data);
    },
  });
}

export function useToggleEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => toggleEventType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENT_TYPES_QUERY_KEY });
    },
  });
}

export function useDeleteEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEventType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EVENT_TYPES_QUERY_KEY });
    },
  });
}
