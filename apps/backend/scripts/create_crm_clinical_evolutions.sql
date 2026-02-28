-- Tabela de evolucao clinica (Epic 5 - Story 5.2).
--
-- OPCAO 1 - Postgres no Docker (este projeto):
--   Com o container rodando (docker compose -f docker/docker-compose.yml up -d):
--   cd apps/backend && docker exec -i completepay-postgres psql -U agent -d completepay_agent < scripts/create_crm_clinical_evolutions.sql
--
-- OPCAO 2 - Migracao Python (cria todas as tabelas do SQLAlchemy, incluindo esta):
--   cd apps/backend && DATABASE_URL=postgresql://agent:password@localhost:5432/completepay_agent python scripts/migrate_db.py
--
-- OPCAO 3 - psql local:
--   psql -U agent -d completepay_agent -h localhost -p 5432 -f scripts/create_crm_clinical_evolutions.sql
--
-- Exige que a tabela crm_clinical_encounters exista (criada pelo migrate_db.py ou pelo create_all).

CREATE TABLE IF NOT EXISTS crm_clinical_evolutions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    encounter_id VARCHAR(36) NOT NULL
        REFERENCES crm_clinical_encounters(id) ON DELETE CASCADE,
    evolution_type VARCHAR(20) NOT NULL DEFAULT 'initial',
    anamnesis TEXT,
    clinical_history TEXT,
    family_history TEXT,
    physical_exam TEXT,
    diagnostic_hypotheses TEXT,
    therapeutic_plan TEXT,
    patient_guidance TEXT,
    suggested_return_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    recorded_by VARCHAR(36),
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_crm_clinical_evolutions_encounter_id
    ON crm_clinical_evolutions(encounter_id);

COMMENT ON TABLE crm_clinical_evolutions IS 'Evolucao clinica do atendimento. Epic 5 - Story 5.2.';
COMMENT ON COLUMN crm_clinical_evolutions.evolution_type IS 'initial | followup | emergency | telehealth';
COMMENT ON COLUMN crm_clinical_evolutions.status IS 'draft | finalized | signed';
