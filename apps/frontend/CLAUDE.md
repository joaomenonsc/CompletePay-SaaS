---
paths: "apps/frontend/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: mudar stack, adicionar nova seção do dashboard, mudar fluxo de auth, nova variável de ambiente

# Frontend — CompletePay Dashboard

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 |
| Linguagem | TypeScript (strict) |
| Estilos | Tailwind CSS v4 |
| Componentes | shadcn/ui (58 componentes) |
| Server state | TanStack Query v5 |
| Client state | Zustand v5 |
| Forms | React Hook Form + Zod |
| HTTP | Axios (apiClient com interceptors) |
| Tables | TanStack Table v8 |
| Linter | Biome |
| Testes | Vitest |
| Build | Next.js standalone (Docker-ready) |

## Estrutura de diretórios

```
src/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root: providers (Query, Preferences, Toaster)
│   ├── (external)/           # Rotas públicas (sem auth)
│   │   └── calendario/       # Booking público
│   └── (main)/               # Rotas autenticadas
│       ├── auth/             # v1, v2, confirmar-email
│       └── dashboard/        # App principal (ver app/CLAUDE.md)
├── components/
│   ├── ui/                   # shadcn/ui (58 arquivos)
│   └── data-table/           # TanStack Table components
├── hooks/                    # TanStack Query hooks (ver hooks/CLAUDE.md)
├── lib/
│   ├── api/                  # Módulos de API (ver lib/api/CLAUDE.md)
│   ├── api-config.ts         # API_BASE_URL e endpoints centralizados
│   ├── query/provider.tsx    # QueryClientProvider (staleTime: 60s)
│   └── utils.ts              # cn(), formatters
├── store/                    # Zustand stores (ver store/CLAUDE.md)
├── stores/preferences/       # Theme e layout preferences
├── types/                    # TypeScript interfaces
│   ├── crm.ts                # Todos os tipos CRM
│   ├── calendar.ts           # Tipos de calendário
│   ├── marketing.ts          # Tipos do módulo Email Marketing
│   └── agent.ts              # Tipos de agentes
└── middleware.ts             # Proteção de rotas (Edge)
```

## Regras obrigatórias

### Imports
**Sempre absolutos via `@/`**, nunca relativos:
```typescript
// ✓ Correto
import { usePatients } from "@/hooks/use-patients"
import apiClient from "@/lib/api/client"
import type { Patient } from "@/types/crm"

// ✗ Errado
import { usePatients } from "../../../hooks/use-patients"
```

### Nomenclatura de arquivos
- Componentes: `PascalCase.tsx` → `PatientForm.tsx`
- Hooks: `use-kebab-case.ts` → `use-patients.ts`
- Pages/layouts: `page.tsx`, `layout.tsx`
- Lib/utils: `kebab-case.ts` → `api-config.ts`

### TypeScript
- Sem `any` — use tipos concretos ou `unknown` com type guard
- Interfaces para props de componentes: `interface MyComponentProps`
- Tipos de API: sempre em `src/types/` correspondente

## Proteção de rotas

`src/middleware.ts` (Edge Runtime):
- Protege `/dashboard/*` — exige cookie `completepay-token` válido (JWT)
- Redirect para `/auth/v2/login?from=<path>` se não autenticado
- Rotas públicas: `/`, `/calendario/*`, `/auth/*`, `/_next/*`, `/api/*`

## Providers (root layout)

```
QueryProvider → staleTime: 60s padrão
  PreferencesStoreProvider → tema, layout
    {children}
    <Toaster /> → sonner (toast.success/error)
    <SpeedInsights />
```

## Multi-tenancy no frontend

- `organization-store.ts` guarda `currentOrganizationId`
- `apiClient` injeta automaticamente `X-Organization-Id` via interceptor
- Query keys incluem `orgId` para cache por org
- `OrgSwitcher` no header permite trocar de org

## Auth flow

1. Login → `setToken(jwt)` no `auth-store`
   - Grava em `localStorage` (persist) + cookie `completepay-token` (para middleware)
2. Todas as requests → `Authorization: Bearer <token>` via interceptor
3. Logout → `clearToken()` → limpa store + cookie
4. Middleware verifica cookie a cada navegação (não chama API)

## Dashboard — seções disponíveis

| Rota | Módulo |
|------|--------|
| `/dashboard/default` | Home |
| `/dashboard/agents` | Agentes LLM |
| `/dashboard/calendario` | Calendário/Agendamentos |
| `/dashboard/crm-saude` | CRM Saúde (ver crm-saude/CLAUDE.md) |
| `/dashboard/email-marketing` | Email Marketing (campanhas, listas, templates) |
| `/dashboard/chat` | Chat |
| `/dashboard/settings` | Configurações |
| `/dashboard/usage` | Uso e billing |
| `/dashboard/finance` | Financeiro |

## Comandos

```bash
npm run dev          # desenvolvimento (porta 3000)
npm run build        # build produção
npm run lint         # Biome lint
npm run typecheck    # tsc --noEmit
npm test             # Vitest
```

## Variáveis de ambiente

```
NEXT_PUBLIC_API_URL   # URL do backend (default: http://localhost:8000)
```
