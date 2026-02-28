-- Tabela de pagamentos (Epic 6).
-- Exige crm_clinical_encounters.

CREATE TABLE IF NOT EXISTS crm_payments (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id VARCHAR(36) NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    encounter_id VARCHAR(36) NOT NULL
        REFERENCES crm_clinical_encounters(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'pix',
    notes TEXT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by VARCHAR(36),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_crm_payments_organization_id
    ON crm_payments(organization_id);
CREATE INDEX IF NOT EXISTS ix_crm_payments_encounter_id
    ON crm_payments(encounter_id);
CREATE INDEX IF NOT EXISTS ix_crm_payments_paid_at
    ON crm_payments(paid_at);

COMMENT ON TABLE crm_payments IS 'Pagamento vinculado a um atendimento. Epic 6.';
