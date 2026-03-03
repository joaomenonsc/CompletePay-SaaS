# Slow Queries

## Sintoma

- Latência de endpoints > 200ms (SLO)
- PostgreSQL log: queries acima de `log_min_duration_statement` (200ms)
- Prometheus: `http_request_duration_seconds` p95 subindo

## Diagnóstico

```bash
# 1. Top 10 queries mais lentas (pg_stat_statements)
psql -U agent -d completepay_agent -f scripts/slow_queries.sql

# 2. Verificar se há Seq Scans em tabelas grandes
psql -U agent -d completepay_agent -c "
  SELECT schemaname, relname, seq_scan, idx_scan,
         round(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 1) AS pct_seq
  FROM pg_stat_user_tables
  WHERE seq_scan > 100
  ORDER BY seq_scan DESC
  LIMIT 10;
"

# 3. Índices ausentes
psql -U agent -d completepay_agent -c "
  SELECT schemaname, tablename, attname, n_distinct, correlation
  FROM pg_stats
  WHERE schemaname = 'public'
    AND n_distinct > 100
  ORDER BY n_distinct DESC
  LIMIT 10;
"
```

## Mitigação Imediata

1. Se query específica: adicionar índice temporário
2. Se generalizado: verificar se `pool_size` está saturado (ver runbook db-connection-exhaustion)

## Resolução

- Criar índices faltantes baseado na análise de `pg_stat_statements`
- Otimizar queries N+1 (usar `joinedload` no SQLAlchemy)
- Implementar cache Redis para queries hot (Onda 2.4)

## Prevenção

- `log_min_duration_statement = 200` no `postgresql.conf`
- Dashboard Grafana PostgreSQL (#7362) com alertas
