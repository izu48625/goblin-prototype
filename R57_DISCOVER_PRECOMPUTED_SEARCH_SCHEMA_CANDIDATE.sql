-- R57 PROTOTYPE: apply in disposable Postgres only. Production requires rollout plan.
-- PostgreSQL 17 STORED generation automatically updates on title/description/snapshot writes.
-- Uses the exact IMMUTABLE search function already indexed in R42/R53.
ALTER TABLE public.topics
  ADD COLUMN discover_search_text_ja text GENERATED ALWAYS AS (
    public.discover_search_blob_v1(title,description,snapshot,'ja')
  ) STORED,
  ADD COLUMN discover_search_text_en text GENERATED ALWAYS AS (
    public.discover_search_blob_v1(title,description,snapshot,'en')
  ) STORED;
CREATE INDEX r57_topics_discover_search_ja_gin
  ON public.topics USING gin (discover_search_text_ja gin_trgm_ops) WHERE visibility='public';
CREATE INDEX r57_topics_discover_search_en_gin
  ON public.topics USING gin (discover_search_text_en gin_trgm_ops) WHERE visibility='public';
ANALYZE public.topics;
