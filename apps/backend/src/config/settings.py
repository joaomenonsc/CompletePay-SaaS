"""Settings com pydantic-settings (carregamento de .env)."""
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


def get_settings() -> Settings:
    return Settings()
