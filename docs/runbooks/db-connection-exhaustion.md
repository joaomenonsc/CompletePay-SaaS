# DB Connection Exhaustion

## Sintoma

- Requests retornando 500 com `TimeoutError` ou `QueuePool limit`
- `/health/db-pool` mostra `checked_out` próximo de `pool_size + overflow`
- Prometheus: métrica `http_request_duration_seconds` com p99 muito alto

## Diagnóstico

```bash
# 1. Verificar estado do pool
curl -s http://localhost:8000/health/db-pool | jq

# 2. Verificar conexões ativas no PostgreSQL
psql -U agent -d completepay_agent -c "
  SELECT count(*) AS total,
         state,
         wait_event_type
  FROM pg_stat_activity
  WHERE datname = 'completepay_agent'
  GROUP BY state, wait_event_type;
"

# 3. Verificar queries travadas
psql -U agent -d completepay_agent -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query
  FROM pg_stat_activity
  WHERE state != 'idle'
  ORDER BY duration DESC
  LIMIT 10;
"
```

## Mitigação Imediata

1. Reiniciar a aplicação: `docker restart completepay-agent`
2. Se não resolver, matar conexões idle:

   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle'
     AND query_start < now() - interval '5 minutes';
   ```

## Resolução

- Verificar se há transaction leaks (sessão DB aberta sem fechar)
- Ajustar `pool_size` e `max_overflow` em `src/db/session.py`
- Verificar se `pool_recycle` está funcionando (conexões stale)

## Prevenção

- Monitorar `/health/db-pool` no Grafana
- Alertar quando `checked_out > 80%` do pool total
