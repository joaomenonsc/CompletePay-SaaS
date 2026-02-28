---
paths: "apps/backend/src/config/**"
---

# Config — Settings, Logging, Database

> Última verificação: 2026-02-25
> Atualizar quando: adicionar nova variável de ambiente, mudar default de settings

## Arquivos

| Arquivo | Responsabilidade |
|---------|----------------|
| `settings.py` | Todas as variáveis de ambiente (pydantic-settings) |
| `logging_config.py` | Setup de logging estruturado (JSON em produção) |
| `database.py` | Configurações de banco (se existir) |
| `models.py` | Modelos de configuração (se existir) |

## `settings.py` — Variáveis de ambiente completas

```python
from src.config.settings import get_settings
settings = get_settings()
```

| Atributo | Env var | Default | Descrição |
|----------|---------|---------|-----------|
| `app_env` | `APP_ENV` | `"development"` | `development` ou `production` |
| `log_level` | `LOG_LEVEL` | `"INFO"` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `log_format` | `LOG_FORMAT` | `""` | `"json"` para logs estruturados em produção |
| `database_url` | `DATABASE_URL` | `postgresql://agent:password@localhost:5432/completepay_agent` | PostgreSQL connection string |
| `redis_url` | `REDIS_URL` | `redis://localhost:6379` | Redis (rate limit, cache) |
| `jwt_secret` | `JWT_SECRET` | `"change-me-in-production"` | **Obrigatório mudar em produção** |
| `api_rate_limit` | `API_RATE_LIMIT` | `100` | Requests por minuto por cliente |
| `cors_origins` | `CORS_ORIGINS` | `"http://localhost:3000,http://localhost:3003"` | CSV de origens permitidas |
| `resend_api_key` | `RESEND_API_KEY` | `""` | Chave Resend para e-mail |
| `email_from_address` | `EMAIL_FROM_ADDRESS` | `"no-reply@elevroi.com.br"` | Remetente de e-mails |
| `email_from_name` | `EMAIL_FROM_NAME` | `"CompletePay"` | Nome do remetente |
| `frontend_url` | `FRONTEND_URL` | `"http://localhost:3003"` | URL do frontend (links em e-mails) |
| `blob_read_write_token` | `BLOB_READ_WRITE_TOKEN` | `""` | Vercel Blob (avatares em produção) |
| `high_value_threshold` | `HIGH_VALUE_THRESHOLD` | `10000.0` | Threshold para transações de alto valor |
| `mcp_server_url` | `MCP_SERVER_URL` | `None` | URL do servidor MCP (opcional) |

## Como usar em código

```python
from src.config.settings import get_settings

settings = get_settings()

# Em qualquer módulo
if settings.app_env == "production":
    # comportamento de produção
```

> `get_settings()` cria uma nova instância a cada chamada (sem cache).
> Para performance em hot paths, armazenar em variável local.

## Logging

```python
import logging
logger = logging.getLogger("completepay.<modulo>")

# Módulos existentes:
# completepay.api     → rotas e middleware
# completepay.calendar → serviço de calendário
# completepay.crm     → módulo CRM (usar este para novos serviços CRM)
```

- `app_env=production` OU `log_format=json` → logs JSON estruturados (uma linha por evento)
- Desenvolvimento → formato legível com timestamp

## Regras

1. **Nunca** hardcodar valores que deveriam estar em env vars
2. `jwt_secret` padrão `"change-me-in-production"` — se detectado em produção, o app deve logar WARNING
3. `cors_origins` em produção: nunca usar `*` ou `localhost`
4. Novos settings: sempre adicionar ao `.env.example` do projeto
5. `get_settings()` é singleton por instância — não há cache global (instância nova a cada chamada)
