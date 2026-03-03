"""
ARQ Worker Settings — configuração do worker de background tasks.

Uso:
    arq src.workers.settings.WorkerSettings

Ou via script:
    python -m src.workers.run

O worker processa:
    - Envio de campanhas de email marketing (batch + retry)
    - Auto-dispatch de campanhas agendadas (cron a cada 60s)
"""
import logging
import os
import time
from datetime import timedelta

from arq import cron
from arq.connections import RedisSettings

logger = logging.getLogger("completepay.worker")


def _get_redis_settings() -> RedisSettings:
    """Converte REDIS_URL para RedisSettings do ARQ."""
    url = os.getenv("REDIS_URL", "redis://localhost:6379")
    # Parse redis://host:port/db
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        database=int(parsed.path.lstrip("/") or "0") if parsed.path and parsed.path != "/" else 0,
        password=parsed.password,
    )


async def startup(ctx: dict) -> None:
    """Inicialização do worker — carrega env e prepara DB session."""
    from dotenv import load_dotenv
    load_dotenv()
    ctx["_job_start_times"] = {}
    logger.info("ARQ Worker starting up...")


async def shutdown(ctx: dict) -> None:
    """Encerramento do worker."""
    logger.info("ARQ Worker shutting down...")


# --- Job Lifecycle Hooks (Onda 1.3 — Observabilidade) ---

async def on_job_start(ctx: dict) -> None:
    """Log estruturado no início de cada job."""
    job_id = ctx.get("job_id", "unknown")
    ctx.setdefault("_job_start_times", {})[job_id] = time.monotonic()
    logger.info(
        "job_start: %s",
        ctx.get("job_try", 1),
        extra={
            "job_id": job_id,
            "function": str(ctx.get("job_name", "")),
            "attempt": ctx.get("job_try", 1),
        },
    )


async def on_job_end(ctx: dict) -> None:
    """Log estruturado no fim de cada job com duração."""
    job_id = ctx.get("job_id", "unknown")
    start = ctx.get("_job_start_times", {}).pop(job_id, None)
    duration_ms = round((time.monotonic() - start) * 1000, 2) if start else None
    logger.info(
        "job_end: %s (%.2fms)",
        job_id,
        duration_ms or 0,
        extra={
            "job_id": job_id,
            "function": str(ctx.get("job_name", "")),
            "duration_ms": duration_ms,
            "attempt": ctx.get("job_try", 1),
        },
    )


async def on_job_error(ctx: dict) -> None:
    """Log de erro + reporte ao Sentry quando um job falha."""
    job_id = ctx.get("job_id", "unknown")
    logger.error(
        "job_error: %s",
        job_id,
        extra={
            "job_id": job_id,
            "function": str(ctx.get("job_name", "")),
            "attempt": ctx.get("job_try", 1),
        },
    )
    # Reportar ao Sentry se disponível (Onda 0.2)
    try:
        import sentry_sdk
        sentry_sdk.capture_message(
            f"ARQ job failed: {ctx.get('job_name', 'unknown')} (id={job_id})",
            level="error",
        )
    except ImportError:
        pass


class WorkerSettings:
    """Configuração do ARQ Worker."""

    redis_settings = _get_redis_settings()

    # Registrar funções de task
    from src.workers.tasks import (
        task_send_campaign,
        task_send_batch_chunk,
        task_check_scheduled_campaigns,
    )

    functions = [
        task_send_campaign,
        task_send_batch_chunk,
    ]

    # Cron jobs: verificar campanhas agendadas a cada 60 segundos
    cron_jobs = [
        cron(
            task_check_scheduled_campaigns,
            minute=None,  # a cada minuto
            second={0},   # no segundo 0
            timeout=timedelta(seconds=30),
            unique=True,
        ),
    ]

    on_startup = startup
    on_shutdown = shutdown
    on_job_start = on_job_start
    on_job_end = on_job_end
    on_job_error = on_job_error

    # Configurações gerais
    max_jobs = 10
    job_timeout = timedelta(minutes=30)  # campanhas grandes podem demorar
    keep_result = timedelta(hours=24)
    retry_jobs = True
    max_tries = 3
    health_check_interval = 30  # heartbeat a cada 30s
