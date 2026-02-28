---
paths: "apps/frontend/src/hooks/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: criar novo hook, mudar padrão de query key, adicionar mutation com invalidação diferente

# Hooks — TanStack Query + Utilitários

## Responsabilidade

Hooks encapsulam **server state** (TanStack Query) e lógica utilitária reutilizável.
Pages/componentes consomem hooks — nunca chamam `apiClient` diretamente.

```
Page → Hook → lib/api/<domínio>.ts → apiClient → Backend
```

## Inventário de hooks

| Arquivo | Exports | Propósito |
|---------|---------|-----------|
| `use-patients.ts` | `usePatients`, `usePatient`, `useCreatePatient`, `useUpdatePatient` | CRUD pacientes |
| `use-professionals.ts` | `useProfessionals`, `useProfessional`, `useCreateProfessional`, `useUpdateProfessional` | CRUD profissionais |
| `use-marketing.ts` | hooks para campanhas, listas e templates de email marketing | Email Marketing |
| `use-agents.ts` | `useAgents`, `useCreateAgent`, `useUpdateAgent`, `useDeleteAgent` | CRUD agentes LLM |
| `use-schedules.ts` | `useSchedules`, `useSchedule`, `useCreateSchedule` | Agenda de disponibilidade |
| `use-event-types.ts` | `useEventTypes`, `useCreateEventType`, `useUpdateEventType` | Tipos de evento |
| `use-available-slots.ts` | `useAvailableSlots` | Slots disponíveis para agendamento |
| `use-bookings.ts` | `useBookings`, `useCreateBooking`, `useCancelBooking` | Bookings do calendário |
| `use-websocket-chat.ts` | `useWebSocketChat` | Chat em tempo real (WebSocket) |
| `use-data-table-instance.ts` | `useDataTableInstance` | TanStack Table setup |
| `use-debounce.ts` | `useDebounce` | Debounce de inputs |
| `use-mobile.ts` | `useIsMobile` | Detecção de viewport mobile |
| `use-api-health.ts` | `useApiHealth` | Verificação de saúde da API |

## Padrão de hook TanStack Query

### Query (leitura)

```typescript
"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchPatients } from "@/lib/api/crm"
import type { PatientListResponse } from "@/types/crm"

// Query key: array com nome do recurso + parâmetros
const PATIENTS_QUERY_KEY = ["crm-patients"] as const

export function usePatients(
  params?: { limit?: number; offset?: number; q?: string }
) {
  return useQuery({
    queryKey: [...PATIENTS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchPatients(params),
  })
}

// Detalhe por ID
export function usePatient(id: string | null) {
  return useQuery({
    queryKey: [...PATIENTS_QUERY_KEY, id],
    queryFn: () => fetchPatient(id!),
    enabled: !!id,   // Não busca se id for null/undefined
  })
}
```

### Mutation (escrita)

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createPatient, updatePatient } from "@/lib/api/crm"

export function useCreatePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PatientCreateInput) => createPatient(body),
    onSuccess: () => {
      // Invalida listagem após criar — força refetch
      queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY })
    },
  })
}

export function useUpdatePatient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatientUpdateInput }) =>
      updatePatient(id, body),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: [...PATIENTS_QUERY_KEY, id] })
    },
  })
}
```

### Query com organização no key

```typescript
// Quando o resultado varia por organização, incluir orgId na query key
import { useOrganizationStore } from "@/store/organization-store"

export function useAgents() {
  const orgId = useOrganizationStore((s) => s.currentOrganizationId)
  return useQuery({
    queryKey: ["agents", orgId],
    queryFn: fetchAgents,
    enabled: !!orgId,   // Não busca sem org selecionada
  })
}
```

## `use-debounce.ts`

```typescript
import { useDebounce } from "@/hooks/use-debounce"

// Em páginas com busca por texto
const [search, setSearch] = useState("")
const debouncedSearch = useDebounce(search, 300)

usePatients({ q: debouncedSearch || undefined })
```

## `use-data-table-instance.ts`

```typescript
import { useDataTableInstance } from "@/hooks/use-data-table-instance"

const table = useDataTableInstance({
  data: patients ?? [],
  columns: patientsColumns,
  getRowId: (row) => row.id,
})

// Usar com <DataTable table={table} columns={columns} />
```

## Convenções de query keys

- String única por domínio: `"crm-patients"`, `"crm-professionals"`, `"agents"`
- Sempre `as const` no array raiz
- Parâmetros de paginação/filtro no final: `[...KEY, params]`
- ID de recurso específico: `[...KEY, id]`
- Org-scoped: `[KEY, orgId]`

## Regras

1. Todo hook começa com `"use client"` (exceto hooks puramente utilitários sem hooks React)
2. Nunca importar `apiClient` diretamente em hooks — chamar função de `@/lib/api/`
3. Naming: `use<Entidade>` (lista), `use<Entidade>(id)` (detalhe), `useCreate<Entidade>`, `useUpdate<Entidade>`, `useDelete<Entidade>`
4. Invalidação: sempre invalidar `queryKey` base após mutations (para refrescar listagens)
5. `enabled: !!id` em queries de detalhe — evita busca com ID undefined
6. Não fazer lógica de UI em hooks — apenas data fetching e mutações
