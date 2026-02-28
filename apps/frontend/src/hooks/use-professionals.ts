"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acceptProfessionalTerm,
  createProfessional,
  createProfessionalDocument,
  deleteProfessionalDocument,
  fetchProfessional,
  fetchProfessionalDocuments,
  fetchProfessionalFinancial,
  fetchProfessionalTerms,
  fetchProfessionals,
  updateProfessional,
  updateProfessionalFinancial,
} from "@/lib/api/crm";
import type {
  ProfessionalCreateInput,
  ProfessionalFinancialUpdateInput,
  ProfessionalTermAcceptInput,
  ProfessionalUpdateInput,
} from "@/types/crm";

const PROFESSIONALS_QUERY_KEY = ["crm-professionals"] as const;

export function useProfessionals(params?: {
  limit?: number;
  offset?: number;
  q?: string;
}) {
  return useQuery({
    queryKey: [...PROFESSIONALS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchProfessionals(params),
  });
}

export function useProfessional(id: string | null) {
  return useQuery({
    queryKey: [...PROFESSIONALS_QUERY_KEY, id],
    queryFn: () => fetchProfessional(id!),
    enabled: !!id,
  });
}

export function useCreateProfessional() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfessionalCreateInput) => createProfessional(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFESSIONALS_QUERY_KEY });
    },
  });
}

export function useUpdateProfessional() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: ProfessionalUpdateInput;
    }) => updateProfessional(id, body),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: PROFESSIONALS_QUERY_KEY });
      queryClient.invalidateQueries({
        queryKey: [...PROFESSIONALS_QUERY_KEY, id],
      });
      queryClient.invalidateQueries({ queryKey: ["crm-professionals-list"] });
    },
  });
}

// Agenda do profissional: PRD 10.3 - usar use-schedules.ts (useSchedule, useUpdateSchedule, useCreateSchedule) + PATCH professional para config.

// ---- Documentos (Story 3.4) ----
export function useProfessionalDocuments(professionalId: string | null) {
  return useQuery({
    queryKey: [...PROFESSIONALS_QUERY_KEY, professionalId, "documents"],
    queryFn: () => fetchProfessionalDocuments(professionalId!),
    enabled: !!professionalId,
  });
}

export function useCreateProfessionalDocument(professionalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof createProfessionalDocument>[1]) =>
      createProfessionalDocument(professionalId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...PROFESSIONALS_QUERY_KEY, professionalId, "documents"],
      });
    },
  });
}

export function useDeleteProfessionalDocument(professionalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      deleteProfessionalDocument(professionalId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...PROFESSIONALS_QUERY_KEY, professionalId, "documents"],
      });
    },
  });
}

// ---- Financeiro (Story 3.4, fin+gcl) ----
export function useProfessionalFinancial(professionalId: string | null) {
  return useQuery({
    queryKey: [...PROFESSIONALS_QUERY_KEY, professionalId, "financial"],
    queryFn: () => fetchProfessionalFinancial(professionalId!),
    enabled: !!professionalId,
  });
}

export function useUpdateProfessionalFinancial(professionalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfessionalFinancialUpdateInput) =>
      updateProfessionalFinancial(professionalId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...PROFESSIONALS_QUERY_KEY, professionalId, "financial"],
      });
    },
  });
}

// ---- Termos (Story 3.4) ----
export function useProfessionalTerms(professionalId: string | null) {
  return useQuery({
    queryKey: [...PROFESSIONALS_QUERY_KEY, professionalId, "terms"],
    queryFn: () => fetchProfessionalTerms(professionalId!),
    enabled: !!professionalId,
  });
}

export function useAcceptProfessionalTerm(professionalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfessionalTermAcceptInput) =>
      acceptProfessionalTerm(professionalId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...PROFESSIONALS_QUERY_KEY, professionalId, "terms"],
      });
    },
  });
}
