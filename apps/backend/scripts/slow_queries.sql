-- Top 10 queries mais lentas (Onda 2.1 — Performance)
-- Rodar com psql quando investigando latência:
--   psql -U agent -d completepay_agent -f scripts/slow_queries.sql

SELECT
  round(mean_exec_time::numeric, 2)  AS avg_ms,
  round(max_exec_time::numeric, 2)   AS max_ms,
  round(total_exec_time::numeric, 2) AS total_ms,
  calls,
  round(stddev_exec_time::numeric, 2) AS stddev_ms,
  left(query, 150)                   AS query_snippet
FROM pg_stat_statements
WHERE mean_exec_time > 50
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Resetar stats após investigação:
-- SELECT pg_stat_statements_reset();
