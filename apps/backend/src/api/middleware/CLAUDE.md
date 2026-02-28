---
paths: "apps/backend/src/api/middleware/**"
---

> Última verificação: 2026-02-25
> Atualizar quando: adicionar novo middleware, mudar PUBLIC_ROUTES, alterar ordem de execução

# Middleware — Pipeline de Requisições

## AVISO: Arquivos críticos de segurança

**NÃO modificar sem story aprovada e review de segurança:**
- `auth.py` — JWT validation + PUBLIC_ROUTES whitelist
- `rate_limit.py` — proteção contra abuso
- `security_headers.py` — headers de segurança HTTP

## Arquivos e responsabilidades

| Arquivo | Classe | Função |
|---------|--------|--------|
| `auth.py` | `JwtRequiredMiddleware` | Valida JWT, seta `request.state.user_id` e `request.state.role` |
| `logging_middleware.py` | `LoggingMiddleware` | Log estruturado de cada requisição (método, path, status, latência) |
| `rate_limit.py` | `RateLimitMiddleware` | Limita requisições por IP (proteção brute-force) |
| `security_headers.py` | `SecurityHeadersMiddleware` | Injeta HSTS, X-Frame-Options, CSP, etc. |

## `auth.py` — JWT Middleware

### Rotas públicas (PUBLIC_ROUTES)

Rotas que **não** exigem JWT:

```python
PUBLIC_ROUTES = [
    ("GET", "/health"),
    ("POST", "/auth/register"),
    ("POST", "/auth/login"),
    ("POST", "/auth/confirm-email"),
    ("POST", "/auth/resend-confirmation"),
    ("GET", "/"),
    ("GET", "/docs"),
    ("GET", "/redoc"),
    ("GET", "/openapi.json"),
    ("GET", "/api/v1/public/calendar"),
    ("POST", "/api/v1/public/calendar"),
    ("GET", "/uploads"),
]
```

> **Nunca** adicionar rotas CRM a PUBLIC_ROUTES — todo CRM exige autenticação.

### State injetado pelo middleware

```python
request.state.user_id  # str | None — ID do usuário autenticado
request.state.role     # str | None — role do JWT ("admin" | "user" | etc.)
request.state.jti      # str | None — JWT ID (para revogação)
```

> Nota: `request.state.role` é o role **do JWT** (nível de app).
> Para RBAC CRM, use `UserOrganization.role` via `require_org_role()` em `deps.py`.

### Funções exportadas por `auth.py`

```python
# Usar em Depends() nas routes
require_user_id(request: Request) -> str     # 401 se não autenticado
require_role(required: str)                  # 403 se role diferente

# Usar em middleware/utils
get_current_user_id(request) -> str | None
get_current_role(request) -> str | None
decode_jwt(token, secret) -> dict | None

# Alias de compatibilidade
JwtOptionalMiddleware = JwtRequiredMiddleware
```

### Fluxo de validação JWT

1. OPTIONS → passa sem validação (CORS preflight)
2. Rota pública → passa; se Bearer presente, valida e seta state (opcional)
3. Rota protegida → exige Bearer válido
4. Se `jti` presente no payload → verifica blacklist em `auth.repository`
5. Seta `request.state.user_id`, `request.state.role`, `request.state.jti`

## Ordem de execução dos middlewares

Middlewares são executados na **ordem inversa** de registro:

```
# Ordem em app.py (adicionado → executa):
app.add_middleware(LoggingMiddleware)       # executa por ÚLTIMO
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(JwtRequiredMiddleware)
app.add_middleware(RateLimitMiddleware)    # executa PRIMEIRO

# Fluxo de request:
Request → RateLimit → JWT → Security → Logging → Handler
Response → Logging → Security → JWT → RateLimit → Client
```

## Adicionando novo middleware

Apenas se houver necessidade de segurança transversal:
1. Criar classe herdando de `BaseHTTPMiddleware`
2. Implementar `async def dispatch(self, request, call_next)`
3. Registrar em `app.py` com a ordem correta
4. Documentar aqui
5. **Nunca** fazer lógica de negócio em middleware — use services/deps
