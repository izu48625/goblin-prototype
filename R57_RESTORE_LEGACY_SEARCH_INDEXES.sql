-- R57 recovery: recreate original R42 expression search indexes if needed.
-- Useful only after reverting the read RPC to R56.
-- These are the exact index predicates and expressions captured from live DB
-- before removing the redundant expression indexes.
CREATE INDEX IF NOT EXISTS topics_discover_search_ja_trgm_idx
ON public.topics USING gin
(public.discover_search_blob_v1(title,description,snapshot,'ja') gin_trgm_ops)
WHERE visibility='public';
CREATE INDEX IF NOT EXISTS topics_discover_search_en_trgm_idx
ON public.topics USING gin
(public.discover_search_blob_v1(title,description,snapshot,'en') gin_trgm_ops)
WHERE visibility='public';
