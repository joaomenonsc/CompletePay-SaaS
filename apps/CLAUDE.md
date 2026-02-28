---
paths: "apps/**"
---

# Apps — Mapa de Contexto da IA

> Use esta tabela para saber qual CLAUDE.md ler antes de começar uma tarefa.

---

## Navegação rápida por tarefa

| Estou trabalhando em... | Leia |
|------------------------|------|
| **Backend — geral** (stack, estrutura, RBAC, env vars) | `apps/backend/CLAUDE.md` |
| Rota FastAPI / endpoint CRM | `apps/backend/src/api/routes/CLAUDE.md` |
| Modelo SQLAlchemy (criar/editar) | `apps/backend/src/db/CLAUDE.md` |
| Schema Pydantic (request/response) | `apps/backend/src/schemas/CLAUDE.md` |
| Service de negócio (audit, booking, storage) | `apps/backend/src/services/CLAUDE.md` |
| Middleware (auth, rate limit, security) | `apps/backend/src/api/middleware/CLAUDE.md` |
| Auth JWT (tokens, bcrypt, revogação) | `apps/backend/src/auth/CLAUDE.md` |
| Multi-tenancy / membership de org | `apps/backend/src/organizations/CLAUDE.md` |
| Settings / variáveis de ambiente | `apps/backend/src/config/CLAUDE.md` |
| Testes backend (pytest, fixtures) | `apps/backend/tests/CLAUDE.md` |
| **Frontend — geral** (stack, stores, auth flow) | `apps/frontend/CLAUDE.md` |
| Page ou layout (App Router) | `apps/frontend/src/app/CLAUDE.md` |
| Dashboard layout / sidebar / navegação | `apps/frontend/src/app/(main)/dashboard/CLAUDE.md` |
| Módulo CRM Saúde (páginas, componentes) | `apps/frontend/src/app/(main)/dashboard/crm-saude/CLAUDE.md` |
| Hook TanStack Query (criar ou editar) | `apps/frontend/src/hooks/CLAUDE.md` |
| Chamada de API (axios, endpoints) | `apps/frontend/src/lib/api/CLAUDE.md` |
| Store Zustand (auth, org, preferências) | `apps/frontend/src/store/CLAUDE.md` |
| Componente UI (shadcn, form, tabela) | `apps/frontend/src/components/CLAUDE.md` |
| Tipos TypeScript | `apps/frontend/src/types/CLAUDE.md` |

---

## Regras cross-cutting (aplicam-se ao sistema inteiro)

| Tópico | Regra |
|--------|-------|
| RBAC CRM (roles, permissões) | `.claude/rules/crm-rbac.md` |
| LGPD / dados clínicos / auditoria | `.claude/rules/lgpd-compliance.md` |
| MCP servers (EXA, Context7, Docker) | `.claude/rules/mcp-usage.md` |

---

## Comunicação entre apps

```
Frontend (Next.js :3000/:3003)
    ↓ HTTP/REST + JWT + X-Organization-Id
Backend (FastAPI :8000)
    ↓ SQLAlchemy
PostgreSQL + pgvector
```

- **Auth:** Frontend guarda JWT em localStorage + cookie. Backend valida via `JwtRequiredMiddleware`.
- **Organização:** Frontend envia `X-Organization-Id` em todo request autenticado. Backend valida membership via `require_organization_id`.
- **Uploads:** Backend serve `/uploads/*` como static files. Frontend usa URL relativa ao `API_BASE_URL`.

---

## Protocolo de manutenção dos CLAUDE.md

Cada CLAUDE.md tem uma linha `> Última verificação: YYYY-MM-DD`.

**Atualizar o arquivo quando:**
- Criar, renomear ou deletar arquivo no diretório coberto
- Mudar um padrão de código (nova convenção, novo hook, novo dep)
- Corrigir informação incorreta detectada durante uso

**Não é necessário atualizar quando:**
- Adicionar lógica de negócio dentro de arquivos já existentes (sem mudar a estrutura)
- Renomear variável local
