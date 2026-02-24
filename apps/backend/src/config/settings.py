"""Settings com pydantic-settings (carregamento de .env)."""
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    database_url: str = "postgresql://agent:password@localhost:5432/completepay_agent"
    redis_url: str = "redis://localhost:6379"
    high_value_threshold: float = 10000.0
    mcp_server_url: str | None = None
    jwt_secret: str = "change-me-in-production"
    api_rate_limit: int = 100  # requests per minute per client
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
    # Vercel Blob (upload de avatares em producao; sem token usa filesystem local)
    blob_read_write_token: str = Field(
        default="", validation_alias="BLOB_READ_WRITE_TOKEN"
    )


def get_settings() -> Settings:
    return Settings()
