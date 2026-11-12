-- R136 security-function review / privilege baseline (2026-11-12).
-- IMPORTANT R138 CORRECTION: this helper is NOT exclusively an internal
-- trigger helper. The initial R136 audit missed an actual browser dependency:
-- base/js/app.js calls sb.rpc('topic_has_submissions') during *owned Public
-- publication updates* to protect prior Community participants.
--
-- Final production privileges confirmed:
--   anon          = false (no unauthenticated direct RPC)
--   authenticated = true  (needed for current owned-work update flow)
--   service_role  = true  (backend permissions preserved)
--   postgres      = true  (three structural-lock triggers preserved)
--
-- The following statements reflect the ACTUAL current live configuration
-- and are safe to reapply. Never revoke authenticated access until an
-- owner-scoped replacement RPC has been deployed, and all clients/mocks
-- updated and tested. The generic Supabase definer advisor warning therefore
-- remains; full elimination requires a distinct reviewed API change.
GRANT EXECUTE ON FUNCTION public.topic_has_submissions(uuid)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.topic_has_submissions(uuid)
  FROM PUBLIC, anon;

-- Read-only verification:
-- SELECT
--   has_function_privilege('anon','public.topic_has_submissions(uuid)','EXECUTE') AS anonymous_access,
--   has_function_privilege('authenticated','public.topic_has_submissions(uuid)','EXECUTE') AS owner_client_access,
--   has_function_privilege('postgres','public.topic_has_submissions(uuid)','EXECUTE') AS trigger_owner_access;
-- Expected: false, true, true.
--
-- Remaining concern: the helper returns a boolean for any supplied UUID,
-- irrespective of ownership; authenticated browser RPC calls can infer
-- submission existence if they already know another work's ID. Investigate
-- an owner-scoped read RPC and separate unexposed internal helper as a future
-- hardening change. Do not blindly grant/revoke or change SECURITY DEFINER
-- without trigger and publication-update regression coverage.
