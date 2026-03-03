# High Error Rate

## Sintoma

- Sentry: aumento súbito de exceções
- Prometheus: `http_requests_total{status=~"5.."}` crescendo
- Usuários reportando erros

## Diagnóstico

```bash
# 1. Verificar health
curl -s http://localhost:8000/health | jq

# 2. Últimos erros nos logs (structured)
docker logs completepay-agent --tail 100 2>&1 | grep '"level":"ERROR"' | tail -20

# 3. Prometheus: taxa de erro nos últimos 5min
# Query PromQL: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

## Mitigação Imediata

1. Verificar se é um endpoint específico (Sentry → Issues → sort by frequency)
2. Se deploy recente: rollback via `git revert` + redeploy
3. Se feature flag: desativar a flag no Unleash

## Resolução

- Analisar stack traces no Sentry
- Verificar se é DB (pool, slow queries) ou externo (API third-party)

## Prevenção

- Alertar no Grafana quando error rate > 0.1% por 5min
- Feature flags para novos deploys críticos
