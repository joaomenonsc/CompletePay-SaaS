-- Tabelas de solicitacao de exames (Epic 5 - Story 5.4).
-- Execucao: mesmo que create_crm_prescriptions.sql (Docker, migrate_db.py ou psql).
-- Exige crm_clinical_encounters.

CREATE TABLE IF NOT EXISTS crm_exam_requests (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    encounter_id VARCHAR(36) NOT NULL
        REFERENCES crm_clinical_encounters(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    recorded_by VARCHAR(36),
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_crm_exam_requests_encounter_id
    ON crm_exam_requests(encounter_id);

CREATE TABLE IF NOT EXISTS crm_exam_request_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    exam_request_id VARCHAR(36) NOT NULL
        REFERENCES crm_exam_requests(id) ON DELETE CASCADE,
    exam_name VARCHAR(255) NOT NULL,
    instructions TEXT,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_crm_exam_request_items_exam_request_id
    ON crm_exam_request_items(exam_request_id);

COMMENT ON TABLE crm_exam_requests IS 'Solicitacao de exames do atendimento. Epic 5 - Story 5.4.';
COMMENT ON TABLE crm_exam_request_items IS 'Item (exame) de uma solicitacao de exames.';
