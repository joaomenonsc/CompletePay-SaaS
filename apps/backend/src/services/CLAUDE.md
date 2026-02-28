---
paths: "apps/backend/src/services/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: criar novo service, mudar assinatura do log_audit, adicionar novo serviço externo

# Services — Lógica de Negócio

## Responsabilidade

Services contêm **lógica de negócio** desacoplada de HTTP. Routes chamam services; services chamam o banco via SQLAlchemy Session.

```
Route → Service → DB (Session)
Route → Service → Serviço externo (email, storage, etc.)
```

## Inventário de services

| Arquivo | Função |
|---------|--------|
| `audit_service.py` | Log de auditoria CRM (append-only) |
| `booking_service.py` | Criação/cancelamento de bookings com anti-race condition |
| `availability_engine.py` | Cálculo de slots disponíveis para calendário |
| `document_storage.py` | Upload/download de documentos (S3 ou local) |
| `avatar_storage.py` | Armazenamento de avatares de usuários/orgs |
| `email_service.py` | Envio de e-mails transacionais |
| `marketing_service.py` | Orquestração de campanhas de email marketing |
| `pdf_service.py` | Geração de PDFs (prescrições, recibos — Epic 5/6) |
| `webhook_service.py` | Disparo de webhooks para eventos |

## `audit_service.py` — uso obrigatório em CRM

```python
from src.services.audit_service import log_audit

log_audit(
    db=db,
    organization_id=organization_id,
    user_id=user_id,
    action="create",           # create | read | update | delete
    resource_type="Patient",   # nome da entidade
    resource_id=patient.id,
    data_classification="CLI", # ADM | CLI | FIN | DOC | SEC | AUD
    data_before=None,          # estado antes (para update)
    data_after=patient_dict,   # estado depois
    ip_address=request.client.host if request.client else None,
    justification=None,        # obrigatório para break-glass
)
db.commit()  # log_audit não faz commit automaticamente
```

> `log_audit` apenas faz `db.add(entry)`. O commit deve ser feito pelo chamador.
> Para operações CLI/FIN/DOC: **sempre** chamar `log_audit` antes do `db.commit()`.

## `booking_service.py` — Calendário

- Usa `SlotConflictError` para race condition (2 bookings no mesmo slot)
- Integra com `EventType`, `AvailabilitySchedule` e `Booking`
- Relação com CRM: `Appointment.booking_id FK → bookings.id` (Option B)

## Criando um novo service

Padrão de estrutura:

```python
"""Docstring em português descrevendo o serviço."""
import logging
from sqlalchemy.orm import Session
from src.db.models_crm import MinhaEntidade

logger = logging.getLogger("completepay.crm")


def criar_coisa(db: Session, organization_id: str, dados: dict) -> MinhaEntidade:
    """Cria uma coisa respeitando as regras de negócio."""
    # validação de negócio aqui (não HTTP)
    obj = MinhaEntidade(organization_id=organization_id, **dados)
    db.add(obj)
    # NÃO fazer db.commit() — deixar para o chamador (route)
    db.flush()  # para obter obj.id se necessário
    return obj
```

## Regras

1. Services **não** importam `fastapi` — sem `HTTPException` em services
   - Levante exceções customizadas (ex.: `SlotConflictError`) que a route trata
2. Services **não** fazem `db.commit()` — o commit é sempre da route
3. Logging com `logging.getLogger("completepay.<dominio>")`
4. Operações externas (email, storage) isoladas em seu próprio service
5. Sem lógica de autenticação/autorização — isso fica em `deps.py` e middleware
