---
paths: "apps/frontend/src/store/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: criar novo store, mudar chave de localStorage, mudar estrutura do auth-store

# Stores — Zustand v5

## Responsabilidade

Stores gerenciam **client state** (não server state). Server state fica no TanStack Query.

| Tipo de estado | Onde fica |
|---------------|-----------|
| Dados do servidor (pacientes, agentes) | TanStack Query (hooks) |
| Token JWT / auth | `auth-store.ts` |
| Organização selecionada | `organization-store.ts` |
| Cache local de agentes | `agents-store.ts` |
| Wizard multi-step | `wizard-store.ts` |
| Tema / layout | `stores/preferences/preferences-store.ts` |
| Estado do email builder | `stores/email-builder-store.ts` |

## Inventário de stores

### `auth-store.ts` — JWT e autenticação

```typescript
import { useAuthStore } from "@/store/auth-store"

// Ler token
const token = useAuthStore((s) => s.token)
const isAuth = useAuthStore((s) => s.isAuthenticated())

// Setar após login
const setToken = useAuthStore((s) => s.setToken)
setToken(jwt)   // grava em localStorage + cookie completepay-token

// Limpar no logout
const clearToken = useAuthStore((s) => s.clearToken)
clearToken()    // remove store + cookie

// Acesso fora de componente (ex.: interceptors)
const token = useAuthStore.getState().token
```

**Persistência:** `localStorage` (key: `completepay-auth`) + cookie `completepay-token` (24h)

> O cookie é necessário para o middleware Edge verificar auth sem chamar a API.

### `organization-store.ts` — Org atual

```typescript
import { useOrganizationStore } from "@/store/organization-store"

// Ler org atual
const orgId = useOrganizationStore((s) => s.currentOrganizationId)

// Trocar de org (OrgSwitcher)
const setOrgId = useOrganizationStore((s) => s.setCurrentOrganizationId)
setOrgId("org-uuid-aqui")

// Acesso fora de componente (interceptors)
const orgId = useOrganizationStore.getState().currentOrganizationId
```

**Persistência:** `localStorage` (key: `completepay-organization`)

> **Sempre** checar `!!orgId` antes de buscar dados org-específicos.
> Queries com `enabled: !!orgId` evitam fetches sem org.

### `agents-store.ts` — Cache local de agentes

Mantém cópia local dos agentes para operações offline/otimistas.
Usado em conjunto com o hook `useAgents` (TanStack Query).

```typescript
import { useAgentsStore } from "@/store/agents-store"

const agents = useAgentsStore((s) => s.agents)
const addAgent = useAgentsStore((s) => s.addAgent)
const updateAgent = useAgentsStore((s) => s.updateAgent)
const toggleStatus = useAgentsStore((s) => s.toggleStatus)
```

**Persistência:** `localStorage` (key: `agents-store`)

### `wizard-store.ts` — Wizard multi-step

Gerencia estado de formulários multi-step (ex.: setup inicial).
Não persistido.

### `stores/email-builder-store.ts` — Estado do editor de email

Gerencia o estado do builder visual de email (blocos, seleção, histórico de edição).
Usado pelos componentes em `components/email-marketing/builder/`.
Não persistido.

### `stores/preferences/preferences-store.ts` — Tema e layout

```typescript
import { usePreferencesStore } from "@/stores/preferences/preferences-store"

const themeMode = usePreferencesStore((s) => s.theme_mode)    // "light" | "dark"
const themePreset = usePreferencesStore((s) => s.theme_preset) // cor do tema
```

## Padrão de criação de store

```typescript
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface MeuEstadoState {
  valor: string | null
  setValor: (v: string) => void
  limpar: () => void
}

export const useMeuEstado = create<MeuEstadoState>()(
  persist(
    (set) => ({
      valor: null,
      setValor: (v) => set({ valor: v }),
      limpar: () => set({ valor: null }),
    }),
    {
      name: "completepay-meu-estado",      // chave no localStorage
      partialize: (s) => ({ valor: s.valor }), // só persistir campos necessários
    }
  )
)
```

## Regras

1. Stores Zustand para estado **do cliente** — não substituem TanStack Query para dados do servidor
2. Sempre `partialize` ao persistir — não salvar funções/handlers
3. Acesso fora de componentes (interceptors, middleware): usar `.getState()` não hooks
4. Nomes de keys localStorage: prefixar com `completepay-` para evitar colisões
5. Stores sem persistência: omitir `persist()` wrapper
6. Atualização de store dispara re-render apenas nos componentes que assinam aquele slice
