"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createPatient, fetchPatient, fetchPatients, updatePatient } from "@/lib/api/crm";
import type { PatientCreateInput, PatientUpdateInput } from "@/types/crm";

const PATIENTS_QUERY_KEY = ["crm-patients"] as const;

export function usePatients(params?: { limit?: number; offset?: number; q?: string }) {
  return useQuery({
    queryKey: [...PATIENTS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchPatients(params),
  });
}

export function usePatient(id: string | null) {
  return useQuery({
    queryKey: [...PATIENTS_QUERY_KEY, id],
    queryFn: () => fetchPatient(id!),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PatientCreateInput) => createPatient(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatientUpdateInput }) =>
      updatePatient(id, body),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: [...PATIENTS_QUERY_KEY, id] });
    },
  });
}
