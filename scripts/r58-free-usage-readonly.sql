-- R58 P3: READ ONLY Supabase Free monitoring snapshot.
-- Execute in Supabase SQL Editor; no extensions/functions/tables are created.
-- This is DB usage only. Egress/MAU requires the Supabase Usage dashboard.
WITH work_counts AS (
  SELECT COUNT(*) AS total,
         COUNT(*) FILTER (WHERE visibility='public') AS public_count,
         COUNT(*) FILTER (WHERE visibility='unlisted') AS unlisted_count,
         COUNT(*) FILTER (WHERE visibility='private') AS private_count
  FROM public.topics
), database_totals AS (
  SELECT pg_database_size(current_database()) AS db_bytes,
         pg_total_relation_size('public.topics') AS topics_bytes,
         pg_total_relation_size('public.rating_sets') AS ratings_bytes,
         pg_total_relation_size('public.scores') AS scores_bytes
), metrics AS (
  SELECT now() AS observed_at_utc, work_counts.*, database_totals.*,
         ROUND(db_bytes * 100.0 / (500*1024*1024),2) AS db_pct_of_500mib
  FROM work_counts CROSS JOIN database_totals
)
SELECT * FROM metrics;
