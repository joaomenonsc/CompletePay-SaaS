#!/usr/bin/env python3
"""
Script de verificacao de saude (Health Check) dos servicos.
Verifica PostgreSQL (e extensao pgvector) e Redis.
Uso: python scripts/health_check.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from src.health import check_postgres, check_redis  # noqa: E402


def main() -> int:
    ok_pg, msg_pg = check_postgres()
    ok_redis, msg_redis = check_redis()
    print("POSTGRES:", msg_pg if ok_pg else f"FALHA - {msg_pg}")
    print("REDIS:", msg_redis if ok_redis else f"FALHA - {msg_redis}")
    return 0 if (ok_pg and ok_redis) else 1


if __name__ == "__main__":
    sys.exit(main())
