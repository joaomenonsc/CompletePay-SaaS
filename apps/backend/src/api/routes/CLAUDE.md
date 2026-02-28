---
paths: "apps/backend/src/api/routes/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: adicionar novo arquivo de rota, mudar prefixo, criar sub-router CRM, mudar roles de um endpoint

# API Routes — FastAPI Routers

## Convenção de arquivo

- Um arquivo por domínio: `<domínio>.py` ou `<domínio>_<sub>.py`
- CRM usa prefixo obrigatório: `crm_*.py`
- Router exportado como `router = APIRouter(...)`
- Registrado em `src/api/app.py` via `app.include_router(...)`

## Mapa completo de rotas

| Arquivo | Prefixo montado | Domínio |
|---------|----------------|---------|
| `health.py` | `/health` | Health check |
| `auth.py` | `/auth` | Autenticação (login, registro) |
| `organizations.py` | `/api/v1/organizations` | Orgs e memberships |
| `agents.py` | `/api/v1/agents` | Agentes LLM |
| `calendar.py` | `/api/v1/calendar` | Calendário (autenticado) |
| `calendar_public.py` | `/api/v1/public/calendar` | Calendário (público) |
| `crm.py` | `/api/v1/crm` | Agregador CRM (monta sub-routers) |
| `chat.py` | `/api/v1/chat` | Chat REST |
| `ws_chat.py` | `/ws` | Chat WebSocket |

## CRM Saúde — sub-routers montados em `crm.py`

| Arquivo | Sub-prefixo | Status |
|---------|------------|--------|
| `crm_patients.py` | `/patients` | Implementado |
| `crm_convenios.py` | `/convenios` | Implementado |
| `crm_professionals.py` | `/professionals` | Implementado |
| `crm_units.py` | `/units` | Implementado |
| `crm_appointments.py` | `/appointments` | Implementado |
| `crm_waitlist.py` | `/waitlist` | Implementado |
| `crm_audit.py` | `/audit` | Implementado |
| `crm_marketing.py` | `/marketing` | Implementado (campanhas, templates, listas) |
| `crm_clinical.py` | `/clinical` | **STUB** (Epic 5) |
| `crm_financial.py` | `/financial` | **STUB** (Epic 6) |

> Stubs retornam `{"items": [], "total": 0}`. Não expandir até Epic aprovado.

## Dependências disponíveis (`src/api/deps.py`)

```python
# Autenticação básica (JWT via middleware)
from src.api.middleware.auth import require_user_id
Depends(require_user_id)               # → str: user_id

# Organização (header X-Organization-Id + membership check)
from src.api.deps import require_organization_id
Depends(require_organization_id)       # → str: organization_id

# RBAC CRM — role do UserOrganization (NÃO do JWT)
from src.api.deps import require_org_role
Depends(require_org_role(["med", "gcl"]))   # → str: role atual

# Classificação de dados + role
from src.api.deps import require_data_access
Depends(require_data_access("CLI", ["med", "enf", "gcl"]))

# Sessão do banco
from src.db.session import get_db
Depends(get_db)                        # → Session
```

## Roles CRM para controle de acesso

> Ver tabela completa em `.claude/rules/crm-rbac.md`.

## Padrão de rota protegida CRM

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.api.deps import require_org_role, require_organization_id
from src.db.session import get_db

router = APIRouter(prefix="/crm/meu-dominio", tags=["CRM - Meu Domínio"])

@router.get("/")
def list_items(
    org_id: str = Depends(require_org_role(["rcp", "med", "gcl"])),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    ...
```

> `require_org_role` já chama `require_organization_id` internamente.
> Use `require_organization_id` separado apenas se não precisar checar role.

## Auditoria obrigatória

Operações que **devem** gravar `AuditLog`:
- Criação/alteração de dados CLI (clínicos)
- Criação/alteração de dados FIN (financeiros)
- Upload e deleção de DOC (documentos)
- Revogar/conceder consentimento LGPD

```python
from src.services.audit_service import log_audit_event
log_audit_event(db, entity_type="Patient", entity_id=patient.id,
                action="UPDATE", actor_id=user_id, actor_role=role,
                data_classification="CLI", changes={...})
```

## Regras de criação de rotas

1. **Nunca** adicionar rota CRM sem `require_org_role` ou `require_organization_id`
2. Rotas GET de listagem: suportar `skip`/`limit` (padrão: `skip=0, limit=50`)
3. IDs em path params: sempre `str` (UUIDs são strings)
4. Retorno de lista: `{"items": [...], "total": int}`
5. Upload de arquivo: usar `UploadFile` + salvar via `document_storage.py`
6. WebSocket: apenas `ws_chat.py` — não criar novos WS sem story aprovada
