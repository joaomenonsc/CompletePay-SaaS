---
paths: "apps/frontend/src/app/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: criar nova página/rota, mudar layout, adicionar rota pública no middleware

# App Router — Next.js 16

## Regra fundamental: Server vs Client

| Diretório / Arquivo | Tipo | Motivo |
|--------------------|------|--------|
| `layout.tsx` (qualquer) | **Server Component** (padrão) | Lê cookies, preferences server-side |
| `page.tsx` (dashboard) | **Client Component** | Precisa de estado, hooks, queries |
| `middleware.ts` | Edge Runtime | Verificação de JWT sem chamada ao backend |

**Adicionar `"use client"` no topo quando o componente usa:**
- `useState`, `useEffect`, `useRef`
- Qualquer hook TanStack Query / Zustand
- Event handlers (`onClick`, `onChange`)
- `useRouter`, `usePathname`, `useSearchParams`

**Manter como Server Component quando:**
- Apenas renderiza dados estáticos ou lê cookies/env
- Usa `async/await` no body do componente
- Não precisa de interatividade

## Estrutura de grupos de rotas

```
(external)/          # Público, sem auth — /calendario (booking público)
(main)/              # Autenticado — /auth/* e /dashboard/*
```

> Grupos entre parênteses não afetam a URL.

## Layouts encadeados

```
app/layout.tsx               → Root: <html>, providers globais, Toaster
  (main)/auth/               → Páginas de login/registro
  (main)/dashboard/layout.tsx → Sidebar + Header (Server Component)
    dashboard/<seção>/layout.tsx → Layout da seção (se existir)
      dashboard/<seção>/page.tsx → Página (Client Component)
```

### `app/(main)/dashboard/layout.tsx`

Server Component que monta toda a estrutura do dashboard:
- Lê cookie `sidebar_state` para estado inicial do sidebar
- Lê preferences (variant, collapsible) do servidor
- Monta `<SidebarProvider>`, `<AppSidebar>`, `<SidebarInset>`
- Header contém: `SidebarTrigger`, `SearchDialog`, `OrgSwitcher`, `ThemeSwitcher`, `AccountSwitcher`

> **Não** adicionar lógica de negócio neste layout — apenas estrutura de shell.

## Padrão de page.tsx (Client Component)

```typescript
"use client"

import { useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { usePatients, useCreatePatient } from "@/hooks/use-patients"
import { toast } from "sonner"

export default function PacientesPage() {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)

  const { data, isLoading } = usePatients({
    limit: pageSize,
    offset: pageIndex * pageSize,
    q: debouncedSearch || undefined,
  })

  const createMutation = useCreatePatient()

  const handleCreate = async (formData: PatientCreateInput) => {
    try {
      await createMutation.mutateAsync(formData)
      toast.success("Paciente criado com sucesso!")
    } catch {
      toast.error("Erro ao criar paciente.")
    }
  }

  return (
    <main>
      {/* ... */}
    </main>
  )
}
```

## Padrão de página de detalhe `[id]/page.tsx`

```typescript
"use client"

import { useParams } from "next/navigation"

export default function PacienteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: patient, isLoading } = usePatient(id)

  if (isLoading) return <p>Carregando…</p>
  if (!patient) return <p>Não encontrado.</p>

  return <div>{patient.full_name}</div>
}
```

## Rotas CRM Saúde (todas existentes)

```
/dashboard/crm-saude/                    → page.tsx (overview)
/dashboard/crm-saude/pacientes/          → page.tsx
/dashboard/crm-saude/pacientes/[id]/     → page.tsx
/dashboard/crm-saude/profissionais/      → page.tsx
/dashboard/crm-saude/profissionais/[id]/ → page.tsx
/dashboard/crm-saude/agendamentos/       → page.tsx
/dashboard/crm-saude/atendimentos/       → page.tsx
/dashboard/crm-saude/atendimentos/[id]/  → page.tsx
/dashboard/crm-saude/lista-espera/       → page.tsx
/dashboard/crm-saude/unidades/           → page.tsx
/dashboard/crm-saude/unidades/[id]/      → page.tsx
/dashboard/crm-saude/financeiro/         → page.tsx
```

> `prescricoes/` **NÃO existe**. Não criar sem story aprovada.

## Middleware (`src/middleware.ts`)

- **Edge Runtime** — sem Node.js APIs
- Cookie verificado: `completepay-token` (JWT)
- Verifica apenas `exp` do JWT (sem chamada ao backend)
- Margem de expiração: 60 segundos
- Redirect: `/auth/v2/login?from=<origem>`

**Matcher configurado:**
```typescript
export const config = {
  matcher: ["/dashboard/:path*", "/calendario/:path*"],
}
```

## Notificações (Toasts)

Usar `sonner` — já configurado no root layout:
```typescript
import { toast } from "sonner"

toast.success("Operação concluída!")
toast.error("Erro ao executar.")
toast.loading("Processando…")
```

## Carregamento e estados vazios

- Loading: `<p>Carregando…</p>` ou spinner do shadcn/ui
- Erro: tratar com `isError` do TanStack Query + `toast.error`
- Vazio: usar componente `<Empty />` de `@/components/ui/empty`
