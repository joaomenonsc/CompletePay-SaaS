---
paths: "apps/backend/src/organizations/**"
---

# Organizations — Multi-tenancy

> Última verificação: 2026-02-25
> Atualizar quando: mudar lógica de membership, adicionar novo campo em Organization

## Responsabilidade

Este módulo é o **núcleo do multi-tenancy**. Gerencia organizações (tenants) e memberships (quem pode fazer o quê em cada org).

## Arquivo único: `service.py`

Todas as operações de org e membership estão aqui. Não há repositório separado — usa SQLAlchemy Session diretamente.

## Funções disponíveis

```python
from src.organizations.service import (
    get_membership_role,      # Usada por TODOS os deps.py de autenticação CRM
    is_member,
    create_organization,
    get_organization_by_id,
    get_organization_by_slug,
    list_organizations_for_user,
    list_organization_members,
    add_organization_member,
    remove_organization_member,
    update_member_role,
    update_organization,
    count_owners,
)
```

## `get_membership_role` — função mais crítica do sistema

```python
role = get_membership_role(db, user_id, organization_id)
# Retorna: str com o role ("owner", "gcl", "med", etc.) ou None se não for membro
```

Esta função é chamada em **cada request** que usa `require_organization_id` ou `require_org_role`.
É o gatekeeper do multi-tenancy — se retornar `None`, acesso negado.

**Normalização interna:**
- `user_id` é normalizado para UUID canônico (lowercase com hifens)
- `organization_id` é lowercased e stripped

## Roles no sistema de orgs (geral vs CRM)

| Role | Contexto geral | Contexto CRM |
|------|---------------|-------------|
| `owner` | Dono da org, acesso total | Normalizado para `gcl` em `require_org_role` |
| `member` | Membro básico | Sem acesso a rotas CRM (role insuficiente) |
| `gcl`, `med`, `rcp`, etc. | N/A | Roles específicos CRM — ver `.claude/rules/crm-rbac.md` |

> `owner` é o único role que funciona tanto no contexto geral quanto no CRM.
> Um usuário com role `member` precisa ter o role CRM específico para acessar rotas CRM.

## Regras importantes

1. **Nunca** criar `UserOrganization` com `role=None` — usar `"member"` como fallback
2. `count_owners` antes de remover membro: impede remover o último owner
3. `update_member_role`: não permite remover o último owner (checar antes de chamar)
4. Slug da org: sempre lowercase, sem espaços — validar na rota antes de chamar service
5. `db.commit()` é feito dentro do service (exceção à regra geral) — é intencional para operações de criação/atualização de org
