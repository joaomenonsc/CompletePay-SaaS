---
paths: "apps/frontend/src/app/(main)/dashboard/crm-saude/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: criar nova página, novo componente em _components/, implementar Epic 5 ou 6

# CRM Saúde — Frontend

## Estrutura de arquivos (real — verificado em fev/2026)

```
crm-saude/
├── page.tsx                    # Overview / dashboard CRM
├── layout.tsx                  # Layout da seção (se existir)
├── _components/                # 25 componentes compartilhados (todos aqui)
├── pacientes/
│   ├── page.tsx                # Lista de pacientes
│   └── [id]/page.tsx           # Detalhe do paciente
├── profissionais/
│   ├── page.tsx                # Lista de profissionais
│   └── [id]/page.tsx           # Detalhe do profissional
├── agendamentos/
│   └── page.tsx                # Agenda / calendário de consultas
├── atendimentos/
│   ├── page.tsx                # Atendimentos clínicos
│   └── [id]/page.tsx           # Detalhe do atendimento clínico
├── lista-espera/
│   └── page.tsx                # Lista de espera
├── unidades/
│   ├── page.tsx                # Lista de unidades
│   └── [id]/page.tsx           # Detalhe da unidade
└── financeiro/
    └── page.tsx                # Financeiro
```

> **NÃO existe** `prescricoes/` — criar só após Epic 5 aprovado.
> **NÃO existe** sub-páginas como `triagem/`, `evolucao/` dentro de `atendimentos/`.
> `agenda/` **NÃO existe** — o módulo correto é `agendamentos/`.

## `_components/` — Inventário completo (25 arquivos)

Todos os componentes ficam neste único diretório (sem subdivisão por seção):

| Arquivo | Propósito |
|---------|-----------|
| `patients-columns.tsx` | Definição de colunas TanStack Table para pacientes |
| `patient-schema.ts` | Zod schema de validação do formulário de paciente |
| `new-patient-dialog.tsx` | Dialog de criação de paciente |
| `patient-guardian-dialog.tsx` | Dialog de responsável legal |
| `patient-insurance-dialog.tsx` | Dialog de plano/convênio do paciente |
| `patient-documents-tab.tsx` | Tab de documentos do paciente |
| `patient-consentimentos-tab.tsx` | Tab de consentimentos LGPD |
| `patient-timeline-tab.tsx` | Tab de histórico/timeline do paciente |
| `professionals-columns.tsx` | Colunas TanStack Table para profissionais |
| `professional-schema.ts` | Zod schema de validação do formulário de profissional |
| `new-professional-dialog.tsx` | Dialog de criação de profissional |
| `edit-professional-dialog.tsx` | Dialog de edição de profissional |
| `professional-documents-tab.tsx` | Tab de documentos do profissional |
| `professional-financial-tab.tsx` | Tab de dados financeiros do profissional |
| `professional-terms-tab.tsx` | Tab de aceite de termos |
| `professional-schedule-tab.tsx` | Tab de agenda do profissional |
| `agenda-grid.tsx` | Grid visual dia/semana (legado — não usado em agendamentos/page.tsx) |
| `crm-calendar-view.tsx` | **Adapter** que converte `AppointmentListItem[]` → `Booking[]` e renderiza o `CalendarView` do módulo `calendario/` |
| `crm-kanban-view.tsx` | Visualização Kanban de agendamentos por status |
| `new-appointment-dialog.tsx` | Dialog de novo agendamento |
| `reschedule-appointment-dialog.tsx` | Dialog de reagendamento |
| `appointment-detail-sheet.tsx` | **Sheet lateral redesenhado** — avatar, status badge, seções com ícones, resolve nomes de unidade/sala via API, ações hierarquizadas no footer |
| `print-utils.ts` | Utilitários de impressão de recibo |
| `new-waitlist-entry-dialog.tsx` | Dialog de entrada na lista de espera |
| `server-pagination.tsx` | Componente de paginação server-side |

## Hooks disponíveis para CRM

```typescript
// Pacientes
import { usePatients, usePatient, useCreatePatient, useUpdatePatient } from "@/hooks/use-patients"

// Profissionais
import { useProfessionals, useProfessional, useCreateProfessional, useUpdateProfessional } from "@/hooks/use-professionals"

// Agendamentos
import { useAvailableSlots } from "@/hooks/use-available-slots"
import { useBookings } from "@/hooks/use-bookings"
```

## API client CRM

```typescript
import {
  // Pacientes
  fetchPatients, fetchPatient, createPatient, updatePatient,
  checkDuplicatePatients,
  // Guardians
  createGuardian, updateGuardian, deleteGuardian,
  // Seguros
  createInsurance, updateInsurance, deleteInsurance,
  // Consentimentos
  fetchConsents, grantConsent, revokeConsent,
  // Documentos
  fetchPatientDocuments, uploadPatientDocument,
  // Profissionais
  fetchProfessionals, fetchProfessional, createProfessional, updateProfessional,
  // Unidades e salas
  fetchUnits, fetchUnit, createRoom, updateRoom, deleteRoom, fetchRooms,
  // Agendamentos
  fetchAppointments, fetchAppointment, createAppointment,
  updateAppointmentStatus, rescheduleAppointment,
  fetchAvailableSlots, fetchAppointmentReminder,
  // Lista de espera
  fetchWaitlist, createWaitlistEntry, updateWaitlistEntryStatus,
  // Atendimento clínico
  createEncounter,
  // Financeiro
  fetchPayments, createPayment,
} from "@/lib/api/crm"
```

> **Constraint do backend:** `GET /api/v1/crm/appointments` aceita `limit` máximo de **100** (`le=100`). Sempre envie `date_from` e `date_to` (obrigatório na prática — sem esses parâmetros pode retornar 422 dependendo do volume).

## Tipos TypeScript (`src/types/crm.ts`)

**Entidades principais:**
- `Patient`, `PatientGuardian`, `PatientInsurance`, `PatientConsent`, `PatientDocument`
- `Professional`, `ProfessionalDocument`, `ProfessionalFinancial`, `ProfessionalTermAcceptance`
- `Appointment`, `WaitlistEntry`
- `Unit`, `Room`, `Convenio`
- `ClinicalEncounter`, `ClinicalEvolution`, `Prescription`, `ExamRequest` (tipos para Epic 5)
- `Payment` (tipo para Epic 6)

**Tipos de input:**
- `PatientCreateInput`, `PatientUpdateInput`
- `ProfessionalCreateInput`, `ProfessionalUpdateInput`
- `AppointmentCreateInput`
- `WaitlistEntryCreateInput`
- `GuardianCreateInput`, `GuardianUpdateInput`
- `InsuranceCreateInput`, `InsuranceUpdateInput`

**Tipos de listagem:**
- `PatientListResponse` → `{ items: Patient[]; total: number; limit: number; offset: number }`
- `ProfessionalListResponse`, `AppointmentListResponse`

## Padrão de página CRM

```typescript
"use client"

import { useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { usePatients, useCreatePatient } from "@/hooks/use-patients"
import { useDataTableInstance } from "@/hooks/use-data-table-instance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table/data-table"
import { DataTableViewOptions } from "@/components/data-table/view-options"
import { toast } from "sonner"
import { patientsColumns } from "../_components/patients-columns"
import { NewPatientDialog } from "../_components/new-patient-dialog"

export default function PacientesPage() {
  const [pageIndex, setPageIndex] = useState(0)
  const pageSize = 20
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = usePatients({
    limit: pageSize,
    offset: pageIndex * pageSize,
    q: debouncedSearch || undefined,
  })

  const patients = data?.items ?? []
  const total = data?.total ?? 0

  const table = useDataTableInstance({
    data: patients,
    columns: patientsColumns,
    getRowId: (row) => row.id,
  })

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pacientes</h1>
        <NewPatientDialog />
      </div>
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <DataTableViewOptions table={table} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : (
            <DataTable table={table} columns={patientsColumns} />
          )}
        </CardContent>
      </Card>
      {/* Paginação server-side */}
    </main>
  )
}
```

## Paginação server-side

```typescript
// Padrão: limit/offset (não page/per_page)
const { data } = usePatients({
  limit: pageSize,     // default: 20
  offset: pageIndex * pageSize,
  q: debouncedSearch || undefined,
})
```

## Regras específicas do CRM

1. Toda página usa `"use client"` — não há server components em `crm-saude/` exceto layout
2. Busca sempre com debounce de 300ms via `useDebounce`
3. Listagens sempre passam `limit` e `offset` (paginação server-side); `limit` máximo para appointments é **100**
4. Upload de arquivo: usar `FormData` sem `Content-Type` (interceptor cuida)
5. **Não criar** páginas novas sem story aprovada para o Epic correspondente
6. Stubs de atendimento clínico e financeiro: mostrar `"Em breve"` ou estado vazio enquanto Epic 5/6 não estão implementados

## `agendamentos/page.tsx` — comportamento atual

- Duas views: **Lista** (tabela paginada, limit=20) e **Calendário** (usa `CrmCalendarView`)
- Uma única query `crm-appointments-wide` sempre ativa (sem `enabled` guard), cobrindo 3 meses atrás → 3 meses à frente, limit=100, alimenta o calendário
- A query de lista usa o mesmo range de datas como fallback para evitar 422
- Filtro de profissional compartilhado entre as duas views
