---
paths: "apps/backend/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: adicionar novo router, mudar stack, nova variável de ambiente, novo padrão de código

# Backend — CompletePay Agent API

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | FastAPI (Python 3.14) |
| ORM | SQLAlchemy 2.0 (mapped_column / Mapped) |
| Banco | PostgreSQL + pgvector |
| Schemas | Pydantic v2 (BaseModel, ConfigDict) |
| Auth | JWT HS256 (`python-jose` / `PyJWT`) |
| Env | `python-dotenv` + `pydantic-settings` |
| Testes | pytest + httpx |

## Ponto de entrada

```
src/api/app.py   → instância FastAPI, middleware pipeline, include_router
src/app.py       → (legado) wrapper para run local
```

## Estrutura de diretórios

```
src/
├── api/
│   ├── app.py           # FastAPI app, middlewares, routers
│   ├── deps.py          # Dependências reutilizáveis (RBAC, org, db)
│   ├── routes/          # Um arquivo por domínio (ver routes/CLAUDE.md)
│   └── middleware/      # JWT, logging, rate limit, security headers
├── auth/                # Service e repository de autenticação JWT
├── config/              # Settings (pydantic-settings), logging, database
├── db/
│   ├── session.py       # Engine lazy, SessionLocal, get_db()
│   ├── models.py        # Organization, UserOrganization, AgentConfig
│   ├── models_calendar.py
│   ├── models_crm.py    # Todos modelos CRM Saúde (ver db/CLAUDE.md)
│   └── models_marketing.py # Modelos Email Marketing (Campaign, Template, Recipient)
├── organizations/       # Service de membership (get_membership_role)
├── schemas/             # Pydantic schemas (ver schemas/CLAUDE.md)
├── services/            # Lógica de negócio (booking, email, storage...)
├── agents/              # Agentes LLM (CompletePay payment/fraud/support)
├── guardrails/          # Validações de input/output dos agentes
├── tools/               # Ferramentas dos agentes (repositories, MCP)
├── workflows/           # Orchestração de workflows multi-agente
└── knowledge/           # RAG / knowledge base setup
```

## Middleware pipeline (ordem de execução)

```
Request →
  RateLimitMiddleware      # 1º a executar (adicionado por último)
  JwtRequiredMiddleware    # seta request.state.user_id + request.state.role
  SecurityHeadersMiddleware
  LoggingMiddleware        # último a executar (adicionado primeiro)
→ Router → Handler
```

> Rotas públicas declaradas em `src/api/middleware/auth.py::PUBLIC_ROUTES`.
> NUNCA adicionar rota nova à lista PUBLIC_ROUTES sem autorização explícita.

## Roteamento registrado em app.py

| Router | Prefixo |
|--------|---------|
| health_router | /health |
| auth_router | /auth |
| organizations_router | /api/v1/organizations |
| agents_router | /api/v1/agents |
| calendar_router | /api/v1/calendar |
| calendar_public_router | /api/v1/public/calendar |
| crm_router | /api/v1/crm |
| chat_router | /api/v1/chat |
| ws_chat_router | /ws |

## Multi-tenancy

- Toda entidade de domínio tem `organization_id: String(36) FK → organizations.id`
- Identificação do tenant via header **`X-Organization-Id`** (obrigatório em rotas CRM)
- Dependência: `require_organization_id` em `src/api/deps.py`

## RBAC e Classificação de dados

> Ver `.claude/rules/crm-rbac.md` para tabelas completas de roles e classificações.

Uso: `Depends(require_org_role(["med", "gcl"]))` em `src/api/deps.py`.
LGPD + AuditLog: ver `.claude/rules/lgpd-compliance.md`.

## Convenções de código

- Docstrings em **português**
- Imports absolutos: `from src.xxx.yyy import ...`
- PKs: `String(36)` com default `_uuid_str()` (UUID4 como string)
- Timestamps: `DateTime(timezone=True)` — nunca `DateTime()` sem timezone
- Sem `any` em type hints — use tipos concretos ou `Optional[X]`
- Error handling: `HTTPException(status_code=..., detail="...")`
- Commits de auditoria: AuditLog é append-only, nunca UPDATE/DELETE

## Variáveis de ambiente

Ver lista completa em `src/config/CLAUDE.md`.

## Arquivos sensíveis — NÃO MODIFICAR sem story aprovada

- `src/api/middleware/auth.py` — JWT e PUBLIC_ROUTES
- `src/api/middleware/rate_limit.py` — rate limiting
- `src/api/middleware/security_headers.py` — headers de segurança
- `src/auth/service.py` — geração/revogação de tokens
- `src/auth/repository.py` — JTI blacklist
