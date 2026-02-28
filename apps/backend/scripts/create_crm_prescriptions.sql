-- Tabelas de prescricao (Epic 5 - Story 5.3).
-- Execucao: mesmo que create_crm_clinical_evolutions.sql (Docker, migrate_db.py ou psql).
-- Exige crm_clinical_encounters.

CREATE TABLE IF NOT EXISTS crm_prescriptions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    encounter_id VARCHAR(36) NOT NULL
        REFERENCES crm_clinical_encounters(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    recorded_by VARCHAR(36),
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_crm_prescriptions_encounter_id
    ON crm_prescriptions(encounter_id);

CREATE TABLE IF NOT EXISTS crm_prescription_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    prescription_id VARCHAR(36) NOT NULL
        REFERENCES crm_prescriptions(id) ON DELETE CASCADE,
    medication VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    posology VARCHAR(255),
    instructions TEXT,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_crm_prescription_items_prescription_id
    ON crm_prescription_items(prescription_id);

COMMENT ON TABLE crm_prescriptions IS 'Prescricao medica do atendimento. Epic 5 - Story 5.3.';
COMMENT ON TABLE crm_prescription_items IS 'Item (medicamento) de uma prescricao.';
