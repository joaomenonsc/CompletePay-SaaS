---
paths: "apps/backend/src/db/**"
---

> Última verificação: 2026-02-27
> Atualizar quando: criar/renomear modelo, mudar padrão de PK/timestamp, implementar modelo do Epic 5 ou 6

# DB — Modelos SQLAlchemy

## Sessão e engine

**Arquivo:** `session.py`

- Engine **lazy** (criado na 1ª chamada): suporta cold start sem DB disponível
- `get_db()` — dependência FastAPI para injetar `Session`
- `Base = declarative_base()` — importar daqui para todos os modelos
- `SessionLocal()` — uso direto (scripts/migrations fora do FastAPI)

```python
from src.db.session import Base, get_db
```

## Padrões obrigatórios dos modelos

```python
# PK sempre String(36) com UUID4 como default
id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)

# Timestamps com timezone
created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

# FK para tenant
organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"))
```

## Inventário de modelos por arquivo

### `models.py` — Core

| Classe | Tabela | Descrição |
|--------|--------|-----------|
| `Organization` | `organizations` | Tenant principal |
| `UserOrganization` | `user_organizations` | Membership + role (String(32)) |
| `AgentConfig` | `agent_configs` | Configuração de agente LLM |

### `models_calendar.py` — Calendário

Inclui: `AvailabilitySchedule`, `EventType`, `Booking`, `BookingAnswer`

### `models_marketing.py` — Email Marketing

| Classe | Tabela | Domínio |
|--------|--------|---------|
| `EmailCampaign` | `marketing_campaigns` | Campanha de e-mail (draft→sending→sent) |
| `EmailTemplate` | `marketing_templates` | Template reutilizável com variáveis de merge |
| `EmailRecipient` | `marketing_recipients` | Destinatário por campanha (pending→sent→bounced...) |
| `EmailUnsubscribe` | `marketing_unsubscribes` | Opt-out global por organização |

> Modelos criados em 2026-02-27. Verificar arquivo para lista completa de campos.

### `models_crm.py` — CRM Saúde (523 linhas)

#### Implementados (16 modelos)

| Classe | Tabela | Domínio |
|--------|--------|---------|
| `Patient` | `crm_patients` | Paciente principal |
| `PatientGuardian` | `crm_patient_guardians` | Responsável legal |
| `Convenio` | `crm_convenios` | Plano de saúde / convênio |
| `PatientInsurance` | `crm_patient_insurances` | Vínculo paciente-convênio |
| `PatientConsent` | `crm_patient_consents` | LGPD: consentimentos |
| `PatientDocument` | `crm_patient_documents` | Documentos do paciente |
| `Unit` | `crm_units` | Unidade / clínica |
| `Room` | `crm_rooms` | Sala da unidade |
| `HealthProfessionalUnit` | `crm_professional_units` | N:N profissional-unidade |
| `HealthProfessional` | `crm_professionals` | Profissional de saúde |
| `ProfessionalDocument` | `crm_professional_documents` | Documentos do profissional |
| `ProfessionalFinancial` | `crm_professional_financials` | Dados financeiros do prof. |
| `ProfessionalTermAcceptance` | `crm_professional_term_acceptances` | Aceite de termos |
| `Appointment` | `crm_appointments` | Consulta (wrapper do Booking) |
| `WaitlistEntry` | `crm_waitlist` | Lista de espera |
| `AuditLog` | `crm_audit_logs` | Auditoria append-only |

#### AINDA NÃO IMPLEMENTADOS

| Classe planejada | Descrição |
|-----------------|-----------|
| `Consultation` | Registro de atendimento clínico (Epic 5) |
| `Prescription` | Prescrição médica (Epic 5) |
| `PrescriptionItem` | Item da prescrição (Epic 5) |
| `Payment` | Pagamento / cobrança (Epic 6) |

> Atenção: os nomes CORRETOS são `Unit` (não `Clinic`), `Room` (não `ClinicRoom`),
> `ProfessionalFinancial` (não `HealthProfessionalFinancial`).

## Relação Appointment ↔ Booking (Architect Decision Option B)

```python
# Appointment tem FK para bookings.id — NÃO duplica dados do calendário
booking_id: Mapped[Optional[str]] = mapped_column(
    String(36), ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True
)
# Também tem FKs para profissional e agendas
professional_id → crm_professionals.id
```

## Auditoria — AuditLog

- Tabela **append-only**: nunca criar endpoint UPDATE ou DELETE para `crm_audit_logs`
- Campos: `entity_type`, `entity_id`, `action`, `actor_id`, `actor_role`, `data_classification`, `changes` (JSONB), `ip_address`, `user_agent`
- Toda operação sensível (CLI, FIN, DOC) deve gravar um registro

## Regras para adicionar novos modelos

1. Arquivo correto: modelos CRM → `models_crm.py`; core → `models.py`
2. Sempre herdar de `Base` (de `src.db.session`)
3. Importar `_uuid_str` do mesmo arquivo (não redefinir)
4. Usar `String(36)` para PKs e FKs de IDs
5. Todos os campos `DateTime` com `timezone=True`
6. Campos flexíveis: usar `JSONB` (PostgreSQL)
7. Sempre adicionar `organization_id` FK com `ondelete="CASCADE"`
8. Adicionar índice em campos de busca frequente (`index=True`)

---

## Workflow de Migrations

Este projeto **não usa Alembic**. Usa um script Python customizado + SQL direto.
Ver decisão em `docs/decisions/ADR-003.md`.

### Sistema de migrations

| Mecanismo | Quando usar |
|-----------|------------|
| `Base.metadata.create_all()` em `scripts/migrate_db.py` | Criar tabelas novas via SQLAlchemy (banco zerado ou nova tabela) |
| `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` em `migrate_db.py` | Adicionar coluna a tabela existente |
| `scripts/create_<tabela>.sql` | Tabela complexa com muitos índices ou FK cruzadas |

### Checklist — adicionando nova tabela

```
1. Criar modelo SQLAlchemy em models_crm.py (ou models.py)
2. Importar o modelo em migrate_db.py (bloco "from src.db import models_crm")
   → Base.metadata.create_all() vai criar a tabela
3. Adicionar colunas extras / índices adicionais via ALTER TABLE IF NOT EXISTS
4. Executar migrate_db.py para validar: python scripts/migrate_db.py
5. Commit: modelo + migrate_db.py juntos no mesmo commit
```

### Checklist — adicionando coluna a tabela existente

```
1. Adicionar campo no modelo SQLAlchemy
2. Adicionar em migrate_db.py:
   cur.execute("ALTER TABLE <tabela> ADD COLUMN IF NOT EXISTS <coluna> <tipo>;")
3. Se necessário, adicionar índice:
   cur.execute("CREATE INDEX IF NOT EXISTS ix_<tabela>_<coluna> ON <tabela>(<coluna>);")
4. Executar: python scripts/migrate_db.py
5. Commit: modelo + migrate_db.py juntos
```

### Executar migrations

```bash
cd apps/backend

# Banco local (Docker):
docker compose -f docker/docker-compose.yml up -d
DATABASE_URL=postgresql://agent:password@localhost:5432/completepay_agent python scripts/migrate_db.py

# SQL direto no container:
docker exec -i completepay-postgres psql -U agent -d completepay_agent < scripts/minha_migration.sql
```

### Regras críticas

- **Sempre** usar `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` — migrations são idempotentes
- **Nunca** DROP TABLE ou DROP COLUMN em migrate_db.py sem aprovação explícita
- **Nunca** renomear coluna existente — adicionar nova + backfill + remover antiga (3 passos)
- Modelos e migrate_db.py devem andar juntos no mesmo commit
- Após adicionar modelo, importá-lo em migrate_db.py ou o `create_all` não vai criá-lo
