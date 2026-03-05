"""Settings com pydantic-settings (carregamento de .env)."""
import logging
import sys

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_settings_logger = logging.getLogger("completepay.settings")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    app_env: str = "development"
    log_level: str = "INFO"
    # "json" = structured logging (uma linha JSON por evento); vazio = formato legível para dev
    log_format: str = ""
    # SBP-015: default sem credenciais embutidas no código
    database_url: str = "postgresql://localhost:5432/completepay_agent"
    redis_url: str = "redis://localhost:6379"
    high_value_threshold: float = 10000.0
    mcp_server_url: str | None = None
    jwt_secret: str = "change-me-in-production"

    # SBP-002: secret de webhook armazenado no servidor (nunca do header do cliente)
    resend_webhook_secret: str = Field(default="", validation_alias="RESEND_WEBHOOK_SECRET")

    @model_validator(mode="after")
    def _check_production_secrets(self) -> "Settings":
        """SBP-010: abortar startup se JWT secret for fraco em produção."""
        if self.app_env == "production":
            if self.jwt_secret in ("change-me-in-production", "") or len(self.jwt_secret) < 32:
                _settings_logger.critical(
                    "FATAL: JWT_SECRET é fraco ou default em produção. "
                    "Defina JWT_SECRET com pelo menos 32 caracteres."
                )
                sys.exit(1)
        return self
    api_rate_limit: int = 100  # requests per minute per client
    # SBP-012: IPs de proxies confiáveis (separados por vírgula) para X-Forwarded-For
    trusted_proxy_ips: str = Field(default="", validation_alias="TRUSTED_PROXY_IPS")
    # CORS: origens permitidas separadas por virgula (ex: http://localhost:3000,http://localhost:3003)
    cors_origins: str = "http://localhost:3000,http://localhost:3003"
    # Email (Resend) - modulo calendario. Variaveis: RESEND_API_KEY, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME
    resend_api_key: str = Field(default="", validation_alias="RESEND_API_KEY")
    email_from_address: str = Field(
        default="no-reply@elevroi.com.br", validation_alias="EMAIL_FROM_ADDRESS"
    )
    email_from_name: str = Field(
        default="CompletePay", validation_alias="EMAIL_FROM_NAME"
    )
    # URL do frontend (links de confirmacao de email, etc.)
    frontend_url: str = Field(
        default="http://localhost:3003", validation_alias="FRONTEND_URL"
    )
    # Email Marketing — ESP adapter settings
    resend_domain: str = Field(default="", validation_alias="RESEND_DOMAIN")
    marketing_batch_size: int = Field(
        default=50, validation_alias="MARKETING_BATCH_SIZE"
    )
    marketing_rate_limit_per_second: float = Field(
        default=8.0, validation_alias="MARKETING_RATE_LIMIT_PER_SECOND"
    )
    # Vercel Blob (upload de avatares em producao; sem token usa filesystem local)
    blob_read_write_token: str = Field(
        default="", validation_alias="BLOB_READ_WRITE_TOKEN"
    )
    # WhatsApp (white-label): configuração global da Evolution API.
    whatsapp_evolution_base_url: str = Field(
        default="", validation_alias="WHATSAPP_EVOLUTION_BASE_URL"
    )
    whatsapp_evolution_api_key: str = Field(
        default="", validation_alias="WHATSAPP_EVOLUTION_API_KEY"
    )
    whatsapp_instance_prefix: str = Field(
        default="cp", validation_alias="WHATSAPP_INSTANCE_PREFIX"
    )
    # Sentry DSN para captura de erros no backend (Onda 0.2 — Performance)
    sentry_dsn: str = Field(default="", validation_alias="SENTRY_DSN")
    # OpenTelemetry OTLP endpoint para tracing distribuído (Onda 3.1)
    otel_endpoint: str = Field(default="", validation_alias="OTEL_ENDPOINT")
    # Unleash URL para feature flags (Onda 4.2)
    unleash_url: str = Field(default="", validation_alias="UNLEASH_URL")


def get_settings() -> Settings:
    return Settings()
