---
paths: "apps/frontend/src/types/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: adicionar novo tipo, mudar interface existente, implementar tipos do Epic 5 ou 6

# Types — TypeScript Interfaces

## Arquivos

| Arquivo | Domínio |
|---------|---------|
| `crm.ts` | CRM Saúde — todas as entidades e inputs |
| `marketing.ts` | Email Marketing — Campaign, Template, Recipient, Unsubscribe |
| `calendar.ts` | Calendário — EventType, Booking, AvailabilitySchedule |
| `agent.ts` | Agentes LLM — Agent, AgentConfig |

## Convenções

- Entidades retornadas pela API: `interface <Entidade>` (não `type`)
- Payloads de criação: `interface <Entidade>CreateInput`
- Payloads de atualização (parcial): `interface <Entidade>UpdateInput`
- Respostas de listagem: `interface <Entidade>ListResponse`
- Campos opcionais da API: `campo: string | null` (não `campo?: string`)
- Datas: sempre `string` (ISO 8601 — o backend retorna string, não Date)

## Tipos CRM (`crm.ts`) — resumo

**Pacientes:**
```typescript
interface Patient {
  id: string; organization_id: string; full_name: string;
  social_name: string | null; birth_date: string; phone: string;
  cpf: string | null; email: string | null; sex: string | null;
  status: string; origin: string | null; created_at: string; updated_at: string;
  guardians?: PatientGuardian[]; insurances?: PatientInsurance[];
}
interface PatientListResponse { items: Patient[]; total: number; limit: number; offset: number; }
interface PatientCreateInput { full_name: string; phone: string; birth_date: string; ... }
interface PatientUpdateInput { full_name?: string | null; phone?: string | null; ... }
```

**Profissionais:**
```typescript
interface Professional { id: string; full_name: string; specialty: string; crm: string | null; ... }
interface ProfessionalFinancial { id: string; professional_id: string; tipo_contrato: string; ... }
interface ProfessionalDocument { id: string; professional_id: string; tipo: string; ... }
interface ProfessionalTermAcceptance { id: string; professional_id: string; accepted_at: string; ... }
```

**Agendamentos:**
```typescript
interface Appointment {
  id: string; organization_id: string; patient_id: string;
  professional_id: string; unit_id: string; booking_id: string | null;
  status: string; scheduled_at: string; ...
}
interface AppointmentListResponse { items: Appointment[]; total: number; }
```

**Unidades:**
```typescript
interface Unit { id: string; organization_id: string; name: string; ... }
interface Room { id: string; unit_id: string; name: string; ... }
```

**Convênios:**
```typescript
interface Convenio { id: string; organization_id: string; nome: string; ... }
```

**Lista de Espera:**
```typescript
interface WaitlistEntry { id: string; patient_id: string; status: string; priority: number; ... }
```

**Tipos para Epics futuros (já definidos, backend não implementado):**
```typescript
interface ClinicalEncounter { ... }   // Epic 5
interface ClinicalEvolution { ... }   // Epic 5
interface Prescription { ... }        // Epic 5
interface ExamRequest { ... }         // Epic 5
interface Payment { ... }             // Epic 6
```

## Regras

1. **Nunca** usar `any` — tipos desconhecidos: `unknown` com type guard
2. Campos nullable da API: `campo: TipoX | null` — não `campo?: TipoX`
3. Campos opcionais em inputs: `campo?: TipoX | null` (ausente = não enviado)
4. Datas sempre como `string` — nunca `Date` (conversão no componente)
5. Enums: usar `string` com comentário de valores possíveis, ou `"valor1" | "valor2"`
6. Listas da API: sempre interface `<Entidade>ListResponse` com `items` e `total`
7. Não repetir tipos — se já existe em `crm.ts`, importar de lá
