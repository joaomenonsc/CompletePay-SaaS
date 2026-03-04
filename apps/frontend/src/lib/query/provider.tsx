"use client";

import { type ReactNode, useState } from "react";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/**
 * Prefixos de query key que PODEM ser persistidos no localStorage.
 * Dados CLI (clínicos) e FIN (financeiros) são excluídos por conformidade LGPD.
 */
const LGPD_SAFE_PREFIXES = [
  "calendar-public",
  "crm-units",
  "emk-templates",
  "emk-lists",
  "emk-domains",
  "automations-workflows",
];

function isSafeToCache(queryKey: readonly unknown[]): boolean {
  const key = String(queryKey[0] ?? "");
  return LGPD_SAFE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

const TEN_MINUTES = 10 * 60 * 1000;

// Dummy storage para SSR onde window não está disponível
const noopStorage = {
  getItem: () => null,
  setItem: () => { },
  removeItem: () => { },
};

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: TEN_MINUTES,
          },
        },
      }),
  );

  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : noopStorage,
      key: "completepay-query-cache",
    })
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: TEN_MINUTES,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" && isSafeToCache(query.queryKey),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

