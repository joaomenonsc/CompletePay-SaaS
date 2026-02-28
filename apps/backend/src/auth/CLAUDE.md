---
paths: "apps/backend/src/auth/**"
---

> Última verificação: 2026-02-25
> Atualizar quando: mudar algoritmo JWT, adicionar campo ao payload, mudar tempo de expiração

# Auth — Autenticação JWT

## AVISO: Arquivos críticos de segurança

**NÃO modificar sem story aprovada:**
- `service.py` — hash de senha e emissão de JWT
- `repository.py` — queries de usuário e JTI blacklist

## Arquivos

| Arquivo | Responsabilidade |
|---------|----------------|
| `service.py` | `hash_password`, `verify_password`, `create_access_token` |
| `repository.py` | Queries diretas ao PostgreSQL via `psycopg` (não SQLAlchemy) |

> Atenção: `repository.py` usa **`psycopg`** (conexão direta), não SQLAlchemy Session.
> Isso é intencional para operações de auth (performance e isolamento).

## `service.py` — Operações de token

```python
from src.auth.service import hash_password, verify_password, create_access_token

# Criar hash de senha (bcrypt, 12 rounds)
hashed = hash_password("senha_plain")

# Verificar senha
ok = verify_password("senha_plain", hashed)

# Gerar JWT — retorna (token, jti)
token, jti = create_access_token(
    sub=user_id,          # user_id como string
    expires_in_seconds=86400,  # 24h padrão
    role="user",          # "admin" | "user"
)
```

### Payload do JWT

```json
{
  "sub": "<user_id>",
  "role": "user",
  "jti": "<uuid4>",
  "iat": <timestamp>,
  "exp": <timestamp>
}
```

- **`sub`**: user_id (string UUID)
- **`role`**: role de app (`"admin"` | `"user"`) — **diferente** do role CRM
- **`jti`**: ID único da sessão (usado para revogação)
- Algoritmo: **HS256**
- Secret: `settings.jwt_secret` (env var `JWT_SECRET`)

## `repository.py` — UserRow e JTI blacklist

### Estrutura de `UserRow`

```python
class UserRow:
    id: uuid.UUID
    email: str
    password_hash: str
    role: str       # "admin" | "user" (role de app, não CRM)
    created_at: datetime
    name: str | None
    avatar_url: str | None
    email_confirmed_at: datetime | None
```

> Tabela `users` acessada diretamente via `psycopg`, não via SQLAlchemy ORM.

### JTI blacklist

```python
from src.auth.repository import is_jti_revoked, revoke_jti

# Verificar se sessão foi revogada (logout)
revoked = is_jti_revoked(jti)

# Revogar sessão (logout)
revoke_jti(jti, expires_at)
```

## Fluxo de autenticação

```
POST /auth/login
  → repository.get_user_by_email(email)
  → service.verify_password(plain, hash)
  → service.create_access_token(sub=user.id, role=user.role)
  → repository.create_session(jti, user_id, expires_at)
  → retorna {"access_token": token}

Request protegida
  → JwtRequiredMiddleware.dispatch()
  → decode_jwt(token, jwt_secret)
  → is_jti_revoked(jti) → 401 se revogado
  → request.state.user_id = payload["sub"]
  → request.state.role = payload["role"]

POST /auth/logout
  → revoke_jti(request.state.jti, ...)
  → 200 OK
```

## Distinção de roles: JWT vs CRM

| Contexto | Onde fica | Valores | Usado por |
|----------|-----------|---------|-----------|
| Role de app | `JWT payload.role` | `"admin"`, `"user"` | `require_role()` em `auth.py` |
| Role CRM | `UserOrganization.role` | `"med"`, `"enf"`, `"rcp"`, `"fin"`, `"gcl"`, `"mkt"` | `require_org_role()` em `deps.py` |

**Nunca usar `request.state.role` para controle de acesso CRM** — sempre usar `require_org_role()`.
