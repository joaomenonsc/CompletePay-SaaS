"""Redis Cache para queries quentes (Onda 2.4 — Performance Enforcement).

Funções utilitárias para cache de respostas de API usando Redis.
Uso típico em rotas de listagem:

    from src.cache.redis_cache import cache_get, cache_set, cache_invalidate_prefix, make_cache_key

    @router.get("/patients")
    async def list_patients(org_id: str = ..., skip: int = 0, limit: int = 50, db = ...):
        key = make_cache_key("patients", org_id, skip=skip, limit=limit)
        if cached := await cache_get(key):
            return cached
        result = patient_service.list_patients(db, org_id, skip=skip, limit=limit)
        serialized = jsonable_encoder(result)
        await cache_set(key, serialized, ttl=30)
        return serialized

TTLs recomendados:
    - Lista de pacientes: 30s (muda com frequência)
    - Dados de convênio: 300s (muda raramente)
    - Configurações da org: 600s (muito estável)
    - Agenda do dia: 60s (crítico, 1min defasado aceitável)
"""
import hashlib
import json
import logging

import redis.asyncio as aioredis

from src.config.settings import get_settings

logger = logging.getLogger("completepay.cache")

_redis: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    """Retorna conexão Redis async (lazy init)."""
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            get_settings().redis_url,
            decode_responses=True,
        )
    return _redis


async def cache_get(key: str) -> dict | list | None:
    """Busca valor no cache. Retorna None se não encontrado ou erro."""
    try:
        val = await _get_redis().get(key)
        if val:
            logger.debug("cache hit: %s", key)
            return json.loads(val)
        logger.debug("cache miss: %s", key)
        return None
    except Exception:
        logger.warning("cache_get falhou para key=%s", key)
        return None


async def cache_set(key: str, value: dict | list, ttl: int = 60) -> None:
    """Armazena valor no cache com TTL em segundos."""
    try:
        await _get_redis().setex(key, ttl, json.dumps(value, default=str))
    except Exception:
        logger.warning("cache_set falhou para key=%s", key)


async def cache_invalidate_prefix(prefix: str) -> None:
    """Invalida todas as keys de um prefixo (ex: 'patients:org-123').

    NOTA: KEYS é O(N) — aceitável para invalidação pontual em write paths,
    mas não usar em hot paths de leitura.
    """
    try:
        r = _get_redis()
        keys = []
        async for k in r.scan_iter(match=f"{prefix}:*", count=100):
            keys.append(k)
        if keys:
            await r.delete(*keys)
            logger.debug("cache_invalidate: %d keys removidas (prefix=%s)", len(keys), prefix)
    except Exception:
        logger.warning("cache_invalidate falhou para prefix=%s", prefix)


def make_cache_key(prefix: str, org_id: str, **params) -> str:
    """Gera key determinística a partir de parâmetros de query (SHA-256, 12 chars)."""
    suffix = hashlib.sha256(
        str(sorted(params.items())).encode()
    ).hexdigest()[:12]
    return f"{prefix}:{org_id}:{suffix}"


# ─── Wrappers síncronos (para handlers `def` FastAPI) ────────────────────────
# Usar em endpoints síncronos que não podem fazer `await`.

def cache_get_sync(key: str) -> dict | list | None:
    """Versão síncrona de cache_get. Usa asyncio.run()."""
    import asyncio
    try:
        return asyncio.run(cache_get(key))
    except RuntimeError:
        # Já existe um event loop rodando (improvável em handler sync, mas seguro)
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(asyncio.run, cache_get(key)).result()


def cache_set_sync(key: str, value: dict | list, ttl: int = 60) -> None:
    """Versão síncrona de cache_set. Usa asyncio.run()."""
    import asyncio
    try:
        asyncio.run(cache_set(key, value, ttl))
    except RuntimeError:
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pool.submit(asyncio.run, cache_set(key, value, ttl)).result()


def cache_invalidate_prefix_sync(prefix: str) -> None:
    """Versão síncrona de cache_invalidate_prefix. Usa asyncio.run()."""
    import asyncio
    try:
        asyncio.run(cache_invalidate_prefix(prefix))
    except RuntimeError:
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pool.submit(asyncio.run, cache_invalidate_prefix(prefix)).result()
