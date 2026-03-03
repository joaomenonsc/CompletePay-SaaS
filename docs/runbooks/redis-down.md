# Redis Down

## Sintoma

- Rate limit usando fallback in-memory (log: "RateLimit: Redis indisponível")
- ARQ jobs não estão executando
- Cache retornando None para todas as keys

## Diagnóstico

```bash
# 1. Verificar se Redis está respondendo
docker exec completepay-redis-prod redis-cli ping

# 2. Verificar uso de memória
docker exec completepay-redis-prod redis-cli info memory | grep used_memory_human

# 3. Verificar logs do container
docker logs completepay-redis-prod --tail 50

# 4. Verificar AOF
docker exec completepay-redis-prod redis-cli info persistence | grep aof
```

## Mitigação Imediata

1. Reiniciar Redis: `docker restart completepay-redis-prod`
2. Se OOM: aumentar `memory` limit no `docker-compose.prod.yml`
3. Se AOF corrompido: `docker exec completepay-redis-prod redis-check-aof --fix appendonly.aof`

## Resolução

- Verificar se `maxmemory-policy` está configurado (recomendado: `allkeys-lru`)
- Monitorar uso de memória no Grafana (dashboard #11835)

## Prevenção

- Alertar quando memória Redis > 80% do limite
- Garantir que AOF está ativo (`appendonly yes`)
