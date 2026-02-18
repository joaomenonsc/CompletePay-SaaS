"use client";

import { useQuery } from "@tanstack/react-query";

import { API_ENDPOINTS } from "@/lib/api-config";

export type ApiHealthStatus = "ok" | "degraded" | "error";

export interface ApiHealthResponse {
  status: "ok" | "degraded";
  services: Record<string, string>;
}

const HEALTH_QUERY_KEY = ["api", "health"] as const;
const REFETCH_INTERVAL_MS = 60_000; // 1 minuto

async function fetchApiHealth(): Promise<ApiHealthResponse> {
  const res = await fetch(API_ENDPOINTS.health(), {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json() as Promise<ApiHealthResponse>;
}

/**
 * Hook para status da API (health check).
 * Faz polling periódico e retorna status agregado para exibir no UI.
 */
export function useApiHealth() {
  const { data, isLoading, isError, error, dataUpdatedAt } = useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: fetchApiHealth,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000, // 30s
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  let status: ApiHealthStatus = "error";
  if (data) {
    status = data.status === "ok" ? "ok" : "degraded";
  } else if (isError && !data) {
    status = "error";
  }

  return {
    status,
    services: data?.services,
    isLoading,
    isError,
    error: error instanceof Error ? error.message : null,
    lastChecked: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
  };
}
