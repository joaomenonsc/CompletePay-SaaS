"""OpenTelemetry — tracing distribuído (Onda 3.1 — Observabilidade Completa).

Instrumenta FastAPI, SQLAlchemy e Redis para captura de spans distribuídos.
Exporta via OTLP/gRPC para Grafana Tempo, Jaeger, ou Sentry (aceita OTLP).

Graceful degradation: se OTEL_ENDPOINT não estiver definido, tracing fica desativado.
"""
import logging

from src.config.settings import get_settings

logger = logging.getLogger("completepay.telemetry")


def init_telemetry(app, engine=None) -> None:
    """Inicializa OpenTelemetry com instrumentação automática.

    Args:
        app: FastAPI application instance
        engine: SQLAlchemy engine (opcional — se None, não instrumenta DB)
    """
    settings = get_settings()
    otel_endpoint = getattr(settings, "otel_endpoint", "")
    if not otel_endpoint:
        logger.debug("OTEL_ENDPOINT não configurado — tracing desativado.")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    except ImportError:
        logger.warning("opentelemetry-sdk não instalado — tracing desativado.")
        return

    provider = TracerProvider()
    provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(endpoint=otel_endpoint)
        )
    )
    trace.set_tracer_provider(provider)

    # FastAPI
    FastAPIInstrumentor.instrument_app(app)
    logger.info("OTel: FastAPI instrumentado.")

    # SQLAlchemy (opcional)
    if engine is not None:
        try:
            from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
            SQLAlchemyInstrumentor().instrument(engine=engine)
            logger.info("OTel: SQLAlchemy instrumentado.")
        except ImportError:
            pass

    # Redis (opcional)
    try:
        from opentelemetry.instrumentation.redis import RedisInstrumentor
        RedisInstrumentor().instrument()
        logger.info("OTel: Redis instrumentado.")
    except ImportError:
        pass

    logger.info("OTel inicializado (endpoint=%s).", otel_endpoint)
