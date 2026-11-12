-- R136 targeted privilege hardening: already applied to live Supabase on
-- 2026-11-12. This file documents the exact idempotent permission change.
--
-- WHY:
-- topic_has_submissions(uuid) is a SECURITY DEFINER helper that reads private
-- rating_sets. Its only DB callers are the three postgres-owned SECURITY
-- DEFINER structural-lock trigger functions. It must not be directly invoked
-- by arbitrary anonymous or signed-in clients.
--
-- Preserve the privileged backend's explicit grant and leave trigger owner
-- PostgreSQL's intrinsic EXECUTE privilege intact.
GRANT EXECUTE ON FUNCTION public.topic_has_submissions(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.topic_has_submissions(uuid)
  FROM PUBLIC, anon, authenticated;

-- Read-only verification (run separately):
-- SELECT
--   has_function_privilege('anon','public.topic_has_submissions(uuid)','EXECUTE') AS anonymous_access,
--   has_function_privilege('authenticated','public.topic_has_submissions(uuid)','EXECUTE') AS signed_in_access,
--   has_function_privilege('postgres','public.topic_has_submissions(uuid)','EXECUTE') AS trigger_owner_access;
-- Expected: false, false, true.
--
-- Narrow rollback if direct client invocation is found to be legitimately
-- necessary in a future release:
-- GRANT EXECUTE ON FUNCTION public.topic_has_submissions(uuid) TO authenticated;
-- (Do not grant it to PUBLIC unless there is a reviewed public requirement.)
