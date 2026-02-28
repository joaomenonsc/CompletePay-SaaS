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
    logger.info("ARQ Worker starting up...")


async def shutdown(ctx: dict) -> None:
    """Encerramento do worker."""
    logger.info("ARQ Worker shutting down...")


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

    # Configurações gerais
    max_jobs = 10
    job_timeout = timedelta(minutes=30)  # campanhas grandes podem demorar
    keep_result = timedelta(hours=24)
    retry_jobs = True
    max_tries = 3
