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
                conn.commit()
            print("Migracao: extensao pgvector e tabela users (com role) garantidas.")

        # Tabelas via SQLAlchemy (organizations, user_organizations, agent_configs). Fase 4.1.
        from src.db.session import Base, engine
        from src.db import models  # noqa: F401 - registra Organization, UserOrganization, AgentConfig
        Base.metadata.create_all(bind=engine)
        with psycopg.connect(url, connect_timeout=10) as conn2:
            with conn2.cursor() as cur2:
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
                conn2.commit()
        print("Tabelas organizations, user_organizations e agent_configs garantidas.")

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
