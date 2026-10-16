-- R57 optional full-schema rollback, only AFTER restoring R56 RPC.
-- Drops R57 search indexes & generated columns. Not run as part of normal rollout.
BEGIN;
SET LOCAL lock_timeout='5s';
DROP INDEX IF EXISTS public.r57_topics_discover_search_ja_gin;
DROP INDEX IF EXISTS public.r57_topics_discover_search_en_gin;
ALTER TABLE public.topics DROP COLUMN IF EXISTS discover_search_text_ja,
DROP COLUMN IF EXISTS discover_search_text_en;
COMMIT;
