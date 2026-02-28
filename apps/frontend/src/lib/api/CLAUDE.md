---
paths: "apps/frontend/src/lib/api/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: adicionar novo módulo de API, nova função em crm.ts, mudar base URL ou interceptors

# API Client — Axios + Módulos por domínio

## Arquitetura

```
lib/api/client.ts       → instância Axios configurada (interceptors JWT + Org)
lib/api/auth.ts         → endpoints de autenticação
lib/api/crm.ts          → endpoints CRM Saúde (879 linhas)
lib/api/marketing.ts    → endpoints Email Marketing (campanhas, listas, templates)
lib/api/calendar.ts     → endpoints calendário autenticado
lib/api/calendar-public.ts → endpoints calendário público
lib/api/chat.ts         → endpoints chat REST
lib/api/organizations.ts → endpoints de organizações
lib/api/agents.ts       → endpoints de agentes LLM
```

## `client.ts` — Axios com interceptors

```typescript
import apiClient from "@/lib/api/client"

// JWT injetado automaticamente (se token presente no auth-store)
// X-Organization-Id injetado automaticamente (se org selecionada)
// FormData: Content-Type removido para multipart/form-data automático
```

**Interceptor request:**
1. Lê `token` do `useAuthStore.getState()`
2. Lê `currentOrganizationId` do `useOrganizationStore.getState()`
3. Remove `Content-Type` quando `config.data instanceof FormData`

> O interceptor só executa no browser (`typeof window !== "undefined"`).
> Para SSR, as chamadas não levam JWT (não há store no servidor).

## `lib/api-config.ts` — Base URL e endpoints

```typescript
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
```

Endpoints são construídos como funções (não strings):
```typescript
// Para adicionar novo endpoint, seguir padrão:
export const API_ENDPOINTS = {
  crm: {
    patients: () => `${API_BASE_URL}/api/v1/crm/patients`,
    patient: (id: string) => `${API_BASE_URL}/api/v1/crm/patients/${id}`,
  }
}
```

## Padrão de função de API (`crm.ts`)

```typescript
// Listar com paginação
export async function fetchPatients(
  params?: { limit?: number; offset?: number; q?: string }
): Promise<PatientListResponse> {
  const { data } = await apiClient.get("/api/v1/crm/patients", { params })
  return data ?? { items: [], total: 0 }
}

// Buscar por ID
export async function fetchPatient(id: string): Promise<Patient> {
  const { data } = await apiClient.get(`/api/v1/crm/patients/${id}`)
  return data
}

// Criar
export async function createPatient(body: PatientCreateInput): Promise<Patient> {
  const { data } = await apiClient.post("/api/v1/crm/patients", body)
  return data
}

// Atualizar (PATCH parcial)
export async function updatePatient(
  id: string,
  body: PatientUpdateInput
): Promise<Patient> {
  const { data } = await apiClient.patch(`/api/v1/crm/patients/${id}`, body)
  return data
}

// Upload de arquivo
export async function uploadPatientDocument(
  patientId: string,
  formData: FormData
): Promise<PatientDocument> {
  const { data } = await apiClient.post(
    `/api/v1/crm/patients/${patientId}/documents`,
    formData
    // NÃO passar Content-Type — interceptor remove automaticamente para FormData
  )
  return data
}
```

## Inventário de funções em `crm.ts`

**Pacientes:**
- `fetchPatients`, `fetchPatient`, `createPatient`, `updatePatient`, `checkDuplicatePatients`

**Responsáveis:**
- `createGuardian`, `updateGuardian`, `deleteGuardian`

**Planos/Convênios do paciente:**
- `createInsurance`, `updateInsurance`, `deleteInsurance`

**Consentimentos LGPD:**
- `fetchConsents`, `grantConsent`, `revokeConsent`

**Documentos do paciente:**
- `fetchPatientDocuments`, `uploadPatientDocument`, `fetchDocumentBlob`, `deletePatientDocument`

**Profissionais:**
- `fetchProfessionals`, `fetchProfessional`, `createProfessional`, `updateProfessional`
- `fetchProfessionalDocuments`, `createProfessionalDocument`
- `fetchProfessionalFinancial`, `updateProfessionalFinancial`
- `fetchProfessionalTerms`, `acceptProfessionalTerm`

**Unidades e Salas:**
- `fetchUnits`, `fetchUnit`, `createRoom`, `updateRoom`, `deleteRoom`

**Agendamentos:**
- `fetchAppointments`, `createAppointment`, `updateAppointmentStatus`, `rescheduleAppointment`
- `fetchAvailableSlots`

**Lista de Espera:**
- `fetchWaitlist`, `createWaitlistEntry`, `updateWaitlistEntryStatus`

**Atendimento Clínico (stub):**
- `fetchEncounters`, `createEncounter`

**Financeiro (stub):**
- `fetchPayments`, `createPayment`

## Tratamento de erros

As funções de API **não** fazem try/catch — erros do Axios propagam para o TanStack Query.
O hook `useMutation` captura via `onError` ou o chamador usa `try/catch` + `toast.error`.

```typescript
// ✓ Na page/componente
try {
  await mutation.mutateAsync(body)
  toast.success("Criado!")
} catch (error) {
  toast.error("Erro ao criar.")
}

// ✗ Não fazer try/catch dentro da função de API em lib/api/
```

## Regras

1. Cada domínio em arquivo separado: não misturar CRM com Calendar no mesmo arquivo
2. Parâmetros de query: passar como `{ params }` no Axios (serializa automaticamente)
3. FormData: nunca definir `Content-Type` manualmente — o interceptor cuida
4. Retorno padronizado de listagem: `{ items: [], total: number }`
5. Tipos de input/output: sempre importar de `@/types/<dominio>`
6. Sem lógica de negócio — apenas chamada HTTP e retorno de dados
