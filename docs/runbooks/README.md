# Runbooks — CompletePay SaaS

Guias operacionais para resposta a incidentes. Cada runbook segue a estrutura:

1. **Sintoma** — como detectar o problema
2. **Diagnóstico** — comandos para confirmar a causa raiz
3. **Mitigação** — ação imediata para restaurar o serviço
4. **Resolução** — fix definitivo
5. **Prevenção** — como evitar recorrência

## Índice

| Runbook | Trigger |
|---------|---------|
| [DB Connection Exhaustion](db-connection-exhaustion.md) | Pool esgotado, timeout em queries |
| [High Error Rate](high-error-rate.md) | Error rate > 0.1% no Sentry/Prometheus |
| [Redis Down](redis-down.md) | Redis indisponível, rate limit fallback |
| [Slow Queries](slow-queries.md) | Queries > 200ms no pg_stat_statements |
| [ARQ Worker Stopped](arq-worker-stopped.md) | Worker de jobs parou silenciosamente |
| [Postmortem Template](postmortem-template.md) | Template para análise pós-incidente |
