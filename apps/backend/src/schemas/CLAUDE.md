---
paths: "apps/backend/src/schemas/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: adicionar novo schema, mudar convenção de nomenclatura, implementar schemas do Epic 5 ou 6

# Schemas — Pydantic v2

## Arquivos

| Arquivo | Schemas |
|---------|---------|
| `crm.py` | Todos schemas do CRM Saúde (Patient, Guardian, Insurance, Consent...) |
| `marketing.py` | Schemas Email Marketing (Campaign, Template, Recipient, Unsubscribe) |
| `calendar.py` | EventType, AvailabilitySchedule, Booking, Location |
| `organization.py` | Organization, UserOrganization |
| `agent.py` | AgentConfig request/response |

## Convenções obrigatórias

### Nomenclatura de classes

```
<Entidade>Create     → payload POST (criação)
<Entidade>Update     → payload PUT/PATCH (atualização parcial — campos Optional)
<Entidade>Response   → resposta da API (inclui id, timestamps)
<Entidade>List       → wrapper de listagem {"items": [...], "total": int}
```

### Modelo de response (from_attributes)

```python
class PatientResponse(BaseModel):
    id: str
    full_name: str
    created_at: datetime
    # ... outros campos

    model_config = ConfigDict(from_attributes=True)
    # obrigatório para ser construído a partir de ORM models
```

### Update schemas — tudo Optional

```python
class PatientUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=3, max_length=255)
    # Todos campos Optional — permite PATCH parcial
```

## Validações customizadas CRM (`crm.py`)

### CPF
- `_cpf_digits(v)` — remove não-dígitos
- `_cpf_check_digits_valid(digits)` — valida dígitos verificadores
- `_format_cpf(digits)` — formata como `XXX.XXX.XXX-XX`
- Retorna `None` se vazio (CPF é opcional para pacientes)

### Telefone
- `_normalize_phone(v)` — remove não-dígitos
- Validação: 10 ou 11 dígitos (com DDD)

### Sexo
- Campo `sex`: pattern `^[MFIO]$` (M, F, I=Intersexo, O=Outro)

### Tipo de atendimento
- Campo `tipo_atendimento`: pattern `^(particular|convenio)$`

## Schemas CRM implementados (`crm.py`)

**Pacientes:**
- `PatientCreate`, `PatientUpdate`, `PatientResponse`
- `PatientGuardianResponse`, `GuardianCreate`, `GuardianUpdate`
- `PatientInsuranceResponse`, `InsuranceCreate`, `InsuranceUpdate`
- `PatientConsentResponse`, `ConsentCreate`

**A criar quando implementar Epic 5/6:**
- `ConsultationCreate`, `ConsultationResponse`
- `PrescriptionCreate`, `PrescriptionResponse`
- `PaymentCreate`, `PaymentResponse`

## Regras

1. **Nunca** usar `dict` como type hint — use `dict[str, Any]` ou schema específico
2. Campos obrigatórios: sem `Optional`, sem `= None`
3. Campos opcionais: sempre `Optional[X] = None` — nunca `Optional[X]` sem default
4. `model_config = ConfigDict(from_attributes=True)` em todos os schemas Response
5. `@field_validator` com `@classmethod` (Pydantic v2)
6. Sem lógica de banco em schemas — apenas validação de formato/regra
7. Strings com tamanho máximo: sempre definir `max_length` em `Field(...)`
