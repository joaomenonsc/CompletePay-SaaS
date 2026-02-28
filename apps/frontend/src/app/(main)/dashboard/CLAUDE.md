---
paths: "apps/frontend/src/app/(main)/dashboard/**"
---

# Dashboard — Layout e Navegação

> Última verificação: 2026-02-27
> Atualizar quando: adicionar nova seção ao sidebar, mudar estrutura do layout, novo componente de header

## Arquitetura do layout

O `layout.tsx` é um **Server Component** que define toda a estrutura visual do dashboard:

```
layout.tsx (Server Component, async)
  → lê cookie "sidebar_state" (open/closed)
  → lê preferences do servidor (variant, collapsible)
  → monta SidebarProvider + AppSidebar + SidebarInset
  → header com: SidebarTrigger | SearchDialog | OrgSwitcher | ApiStatusIndicator | LayoutControls | ThemeSwitcher | AccountSwitcher
  → {children} no conteúdo principal (padding p-4 md:p-6)
```

**Regra:** `layout.tsx` é Server Component — não adicionar `"use client"`, hooks ou estado aqui.

## Componentes do dashboard (`_components/`)

### Sidebar

| Arquivo | Responsabilidade |
|---------|----------------|
| `sidebar/app-sidebar.tsx` | Componente raiz do sidebar (Client Component) |
| `sidebar/nav-main.tsx` | Itens de navegação principal (com ícones, URLs) |
| `sidebar/nav-secondary.tsx` | Itens secundários do sidebar |
| `sidebar/nav-user.tsx` | Avatar e menu do usuário logado |
| `sidebar/nav-documents.tsx` | Seção de documentos no sidebar |
| `sidebar/account-switcher.tsx` | Troca de conta/usuário |
| `sidebar/search-dialog.tsx` | Dialog de busca global |
| `sidebar/theme-switcher.tsx` | Toggle light/dark |
| `sidebar/layout-controls.tsx` | Controles de variant/collapsible do sidebar |

### Header

| Arquivo | Responsabilidade |
|---------|----------------|
| `org-switcher.tsx` | Seletor de organização ativa |
| `api-status-indicator.tsx` | Indicador de saúde da API backend |

## Como adicionar uma nova seção ao sidebar

A navegação é definida em **`src/navigation/sidebar/sidebar-items.ts`**:

```typescript
// sidebar-items.ts — adicionar novo item ao array correto
{
  title: "Nova Seção",
  url: "/dashboard/nova-secao",
  icon: IconeName,     // de lucide-react
}
```

Depois criar a rota correspondente em `src/app/(main)/dashboard/nova-secao/page.tsx`.

> Nunca hardcodar itens de navegação dentro de `app-sidebar.tsx` — sempre usar `sidebar-items.ts`.

## Estrutura de `app-sidebar.tsx`

Client Component que:
1. Usa `useQuery` para buscar dados do usuário logado (`getMe`)
2. Usa `usePreferencesStore` para tema
3. Monta `<Sidebar>` com `<NavMain>`, `<NavUser>`, etc.
4. Recebe `variant` e `collapsible` como props (vêm do `layout.tsx` server-side)

## Preferências de layout

Controladas por `stores/preferences/preferences-store.ts`:

| Preferência | Valores | Cookie/localStorage |
|-------------|---------|---------------------|
| `sidebar_variant` | `"inset"`, `"sidebar"`, `"floating"` | Cookie `sidebar_variant` |
| `sidebar_collapsible` | `"icon"`, `"offcanvas"`, `"none"` | Cookie `sidebar_collapsible` |
| `sidebar_state` | `"true"` / `"false"` | Cookie `sidebar_state` |
| `theme_mode` | `"light"`, `"dark"`, `"system"` | localStorage |
| `theme_preset` | `"default"`, `"blue"`, etc. | localStorage |
| `navbar_style` | `"sticky"`, `"static"` | localStorage |

## Seções do dashboard (primeira camada)

```
dashboard/
├── default/         → Home / visão geral
├── agents/          → Agentes LLM (CRUD, analytics, channels)
├── calendario/      → Calendário e agendamentos
├── crm/             → CRM genérico
├── crm-saude/       → CRM Saúde (ver crm-saude/CLAUDE.md)
├── email-marketing/ → Email Marketing (campanhas, listas, templates)
├── chat/            → Chat em tempo real
├── settings/        → Configurações de conta e org
├── usage/           → Uso e billing
├── finance/         → Dashboard financeiro
├── coming-soon/     → Placeholder
└── sentry-test/     → Teste de error tracking
```

## Regras

1. `layout.tsx` é Server Component — qualquer estado/interatividade vai em `_components/`
2. Itens de sidebar: sempre em `sidebar-items.ts`, nunca hardcodados no componente
3. Novas seções: criar diretório + `page.tsx` + adicionar ao `sidebar-items.ts`
4. Header é fixo — não modificar `layout.tsx` para adicionar itens temporários
5. Conteúdo do dashboard tem padding `p-4 md:p-6` — não adicionar padding extra nas páginas
