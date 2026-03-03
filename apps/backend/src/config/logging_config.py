"""
Configuracao de logs estruturados (Fase 8).
Em producao (APP_ENV=production) ou LOG_FORMAT=json: saida JSON por linha.
Caso contrario: formato legivel para desenvolvimento.
"""
import json
import logging
import os
import sys
from datetime import datetime, timezone


def _json_serial(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(type(obj))


class StructuredFormatter(logging.Formatter):
    """Formata registros como JSON por linha (uma linha por evento)."""

    def format(self, record: logging.LogRecord) -> str:
        # Importar aqui para evitar circular import no startup
        from src.api.middleware.correlation_middleware import get_request_id

        log_dict = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Correlation ID: rastrear requests ponta a ponta (Onda 0.3)
        req_id = get_request_id()
        if req_id:
            log_dict["request_id"] = req_id
        if record.exc_info:
            log_dict["exception"] = self.formatException(record.exc_info)
        # Campos extras (ex.: method, path, status no middleware)
        for key, value in record.__dict__.items():
            if key not in (
                "name", "msg", "args", "created", "filename", "funcName",
                "levelname", "levelno", "lineno", "module", "msecs",
                "pathname", "process", "processName", "relativeCreated",
                "stack_info", "exc_info", "exc_text", "thread", "threadName",
                "message", "taskName",
            ):
                if value is not None:
                    try:
                        json.dumps(value, default=_json_serial)
                        log_dict[key] = value
                    except TypeError:
                        log_dict[key] = str(value)
        return json.dumps(log_dict, ensure_ascii=False, default=_json_serial)


def setup_logging(
    log_level: str | None = None,
    log_format: str | None = None,
    app_env: str | None = None,
) -> None:
    """
    Configura o logging global.
    Se app_env=production ou log_format=json: usa StructuredFormatter (JSON).
    Senao: formato legivel para dev.
    """
    level = log_level or os.getenv("LOG_LEVEL", "INFO") or "INFO"
    fmt = log_format or os.getenv("LOG_FORMAT", "")
    env = app_env or os.getenv("APP_ENV", "development")

    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    if root.handlers:
        for h in root.handlers[:]:
            root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(root.level)

    if fmt == "json" or env == "production":
        handler.setFormatter(StructuredFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
            )
        )
    root.addHandler(handler)
