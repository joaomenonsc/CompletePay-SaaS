# ARQ Worker Stopped

## Sintoma

- Campanhas de email não estão sendo enviadas
- Jobs agendados não executam (cron `task_check_scheduled_campaigns` parou)
- Log: nenhuma entrada `job_start` nos últimos 5min

## Diagnóstico

```bash
# 1. Verificar se o worker está rodando
docker ps | grep worker

# 2. Verificar logs do worker
docker logs completepay-worker --tail 50

# 3. Verificar heartbeat do ARQ no Redis
docker exec completepay-redis-prod redis-cli keys "arq:health:*"

# 4. Verificar jobs pendentes
docker exec completepay-redis-prod redis-cli llen arq:queue
```

## Mitigação Imediata

1. Reiniciar worker: `docker restart completepay-worker`
2. Se Redis está down: ver runbook [redis-down.md](redis-down.md)
3. Se o worker crashou no startup: verificar logs de erro

## Resolução

- Se OOM: aumentar `memory` limit do container worker
- Se deadlock: verificar se há job com `job_timeout` excedido
- Se erro de conexão DB: verificar pool (runbook db-connection-exhaustion)

## Prevenção

- `health_check_interval = 30` garante heartbeat no Redis
- `on_job_error` reporta falhas ao Sentry automaticamente
- Monitorar ausência de heartbeat no Grafana
