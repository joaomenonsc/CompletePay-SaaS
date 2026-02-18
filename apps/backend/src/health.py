"""
Health check dos servicos (PostgreSQL, Redis).
Usado pela CLI (comando health) e pela API (rota /health).
"""
import os
from typing import Tuple


def check_postgres() -> Tuple[bool, str]:
    """
    Verifica conexao com PostgreSQL e extensao pgvector.
    Returns:
        (True, "OK") ou (False, mensagem de erro).
    """
    try:
        import psycopg
    except ImportError:
        return False, "psycopg nao instalado"
    url = os.getenv(
        "DATABASE_URL",
        "postgresql://agent:password@localhost:5432/completepay_agent",
    )
    try:
        with psycopg.connect(url, connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
                cur.execute("SELECT extname FROM pg_extension WHERE extname = 'vector'")
                if cur.fetchone() is None:
                    return True, "OK (pgvector nao instalado)"
                return True, "OK"
    except Exception as e:
        return False, str(e)


def check_redis() -> Tuple[bool, str]:
    """
    Verifica conexao com Redis.
    Returns:
        (True, "OK") ou (False, mensagem de erro).
    """
    try:
        import redis
    except ImportError:
        return False, "redis nao instalado"
    url = os.getenv("REDIS_URL", "redis://localhost:6379")
    try:
        r = redis.from_url(url, socket_connect_timeout=5)
        r.ping()
        return True, "OK"
    except Exception as e:
        return False, str(e)


def run_health_checks() -> Tuple[bool, dict]:
    """
    Executa todos os checks. Retorna (tudo_ok, detalhes).
    """
    ok_pg, msg_pg = check_postgres()
    ok_redis, msg_redis = check_redis()
    details = {"postgres": msg_pg, "redis": msg_redis}
    return ok_pg and ok_redis, details
