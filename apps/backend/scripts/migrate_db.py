#!/usr/bin/env python3
"""
Migracoes de banco: garante extensao pgvector e conectividade.
As tabelas do Agno (agno_memories, sessoes, etc.) sao criadas automaticamente
pelo framework na primeira utilizacao do Agent com db=PostgresDb().
Uso: python scripts/migrate_db.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def run_migrate() -> int:
    from dotenv import load_dotenv
    load_dotenv()
    try:
        import psycopg
    except ImportError:
        print("Instale psycopg: pip install 'psycopg[binary]'")
        return 1
    url = os.getenv("DATABASE_URL", "postgresql://agent:password@localhost:5432/completepay_agent")
    try:
        with psycopg.connect(url, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        email VARCHAR(255) NOT NULL UNIQUE,
                        password_hash VARCHAR(255) NOT NULL,
                        role VARCHAR(32) NOT NULL DEFAULT 'user',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                """)
                cur.execute("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user';
                """)
                cur.execute("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
                """)
                cur.execute("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);
                """)
                cur.execute("""
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS email_confirm_tokens (
                        token VARCHAR(64) PRIMARY KEY,
                        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        expires_at TIMESTAMPTZ NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_email_confirm_tokens_user_id ON email_confirm_tokens(user_id);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_email_confirm_tokens_expires_at ON email_confirm_tokens(expires_at);")
                # Contas existentes passam a ser consideradas confirmadas
                cur.execute("""
                    UPDATE users SET email_confirmed_at = created_at WHERE email_confirmed_at IS NULL;
                """)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS user_sessions (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        jti VARCHAR(64) NOT NULL UNIQUE,
                        device_info VARCHAR(512),
                        ip_address VARCHAR(64),
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);")
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS revoked_tokens (
                        jti VARCHAR(64) PRIMARY KEY,
                        revoked_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                """)
                conn.commit()
            print("Migracao: extensao pgvector, users e user_sessions/revoked_tokens garantidas.")

        # Tabelas via SQLAlchemy (organizations, user_organizations, agent_configs, calendario).
        from src.db.session import Base, engine
        from src.db import models  # noqa: F401 - registra Organization, UserOrganization, AgentConfig
        from src.db import models_calendar  # noqa: F401 - registra tabelas do modulo Calendario
        from src.db import models_crm  # noqa: F401 - registra Patient, PatientConsent, etc.
        from src.db import models_marketing  # noqa: F401 - registra EmkTemplate, EmkCampaign, etc.
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            err_str = str(e).lower()
            if "already exists" in err_str or "duplicate" in err_str:
                print("Algumas tabelas ou indices ja existem; continuando.")
            else:
                raise
        with psycopg.connect(url, connect_timeout=10) as conn2:
            with conn2.cursor() as cur2:
                cur2.execute(
                    "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);"
                )
                cur2.execute(
                    "ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS organization_id VARCHAR(36);"
                )
                cur2.execute("""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.table_constraints
                            WHERE table_name = 'agent_configs' AND constraint_name = 'agent_configs_organization_id_fkey'
                        ) THEN
                            ALTER TABLE agent_configs
                            ADD CONSTRAINT agent_configs_organization_id_fkey
                            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
                        END IF;
                    END $$;
                """)
                # CRM: novas colunas em crm_health_professionals (Story 3.1 vinculo)
                cur2.execute(
                    "ALTER TABLE crm_health_professionals ADD COLUMN IF NOT EXISTS user_id VARCHAR(36);"
                )
                cur2.execute(
                    "ALTER TABLE crm_health_professionals ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20);"
                )
                cur2.execute(
                    "ALTER TABLE crm_health_professionals ADD COLUMN IF NOT EXISTS modality VARCHAR(20);"
                )
                # Story 3.2: agenda do profissional
                cur2.execute("""
                    ALTER TABLE crm_health_professionals
                    ADD COLUMN IF NOT EXISTS schedule_id VARCHAR(36)
                    REFERENCES availability_schedules(id) ON DELETE SET NULL;
                """)
                cur2.execute(
                    "ALTER TABLE crm_health_professionals ADD COLUMN IF NOT EXISTS default_slot_minutes INTEGER;"
                )
                cur2.execute(
                    "ALTER TABLE crm_health_professionals ADD COLUMN IF NOT EXISTS accepts_encaixe BOOLEAN NOT NULL DEFAULT FALSE;"
                )
                cur2.execute(
                    "ALTER TABLE crm_health_professionals ADD COLUMN IF NOT EXISTS buffer_between_minutes INTEGER;"
                )
                # Epic 4: event_type_id para agendamento (slots/Booking)
                cur2.execute("""
                    ALTER TABLE crm_health_professionals
                    ADD COLUMN IF NOT EXISTS event_type_id VARCHAR(36)
                    REFERENCES event_types(id) ON DELETE SET NULL;
                """)
                cur2.execute(
                    "CREATE INDEX IF NOT EXISTS ix_crm_health_professionals_event_type_id ON crm_health_professionals(event_type_id);"
                )
                # Story 3.3: Unit config + Room
                cur2.execute(
                    "ALTER TABLE crm_units ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);"
                )
                cur2.execute(
                    "ALTER TABLE crm_units ADD COLUMN IF NOT EXISTS default_slot_minutes INTEGER;"
                )
                cur2.execute(
                    "ALTER TABLE crm_units ADD COLUMN IF NOT EXISTS min_advance_minutes INTEGER;"
                )
                cur2.execute(
                    "ALTER TABLE crm_units ADD COLUMN IF NOT EXISTS max_advance_days INTEGER;"
                )
                cur2.execute(
                    "ALTER TABLE crm_units ADD COLUMN IF NOT EXISTS cancellation_policy TEXT;"
                )
                cur2.execute(
                    "ALTER TABLE crm_units ADD COLUMN IF NOT EXISTS specialities JSONB;"
                )
                cur2.execute(
                    "ALTER TABLE crm_units ADD COLUMN IF NOT EXISTS modalities JSONB;"
                )
                cur2.execute(
                    "ALTER TABLE crm_units ADD COLUMN IF NOT EXISTS convenio_ids JSONB;"
                )
                # Epic 6: tabela crm_payments (pagamento por atendimento)
                cur2.execute("""
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
                """)
                cur2.execute(
                    "CREATE INDEX IF NOT EXISTS ix_crm_payments_organization_id ON crm_payments(organization_id);"
                )
                cur2.execute(
                    "CREATE INDEX IF NOT EXISTS ix_crm_payments_encounter_id ON crm_payments(encounter_id);"
                )
                cur2.execute(
                    "CREATE INDEX IF NOT EXISTS ix_crm_payments_paid_at ON crm_payments(paid_at);"
                )
                # Email Marketing: add blocks_json column to emk_templates
                cur2.execute(
                    "ALTER TABLE emk_templates ADD COLUMN IF NOT EXISTS blocks_json TEXT;"
                )
                # EMK-5: campos de remetente na campanha
                cur2.execute(
                    "ALTER TABLE emk_campaigns ADD COLUMN IF NOT EXISTS from_email VARCHAR(255);"
                )
                cur2.execute(
                    "ALTER TABLE emk_campaigns ADD COLUMN IF NOT EXISTS from_name VARCHAR(255);"
                )
                cur2.execute(
                    "ALTER TABLE emk_campaigns ADD COLUMN IF NOT EXISTS reply_to VARCHAR(255);"
                )
                conn2.commit()
        print("Tabelas organizations, user_organizations, agent_configs e calendario garantidas.")

        # Backfill: agentes sem organization_id recebem a primeira org do dono (owner preferido).
        with psycopg.connect(url, connect_timeout=10) as conn3:
            with conn3.cursor() as cur3:
                cur3.execute("""
                    UPDATE agent_configs ac
                    SET organization_id = (
                        SELECT uo.organization_id FROM user_organizations uo
                        WHERE uo.user_id = ac.user_id
                        ORDER BY (uo.role = 'owner') DESC NULLS LAST, uo.created_at ASC
                        LIMIT 1
                    )
                    WHERE ac.organization_id IS NULL
                    AND EXISTS (SELECT 1 FROM user_organizations uo2 WHERE uo2.user_id = ac.user_id);
                """)
                updated = cur3.rowcount
                conn3.commit()
        if updated and updated > 0:
            print(f"Backfill: {updated} agente(s) associado(s) à organização padrão do dono.")
        print("Tabelas Agno (memoria, sessoes) serao criadas na primeira execucao do agente.")
        return 0
    except Exception as e:
        print("Erro na migracao:", e)
        return 1


if __name__ == "__main__":
    sys.exit(run_migrate())
