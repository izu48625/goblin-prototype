-- R140, applied to connected production Supabase on 2026-11-12.
-- Author consent needs to be checked both by the Public/Community UI and by
-- the privileged rating gateway's server-side RPC validation.
--
-- Same function name/signature/owner/grants/security definer semantics as before.
-- Neither existing Community data nor any work metadata is modified.
CREATE OR REPLACE FUNCTION public.topic_accepts_my_ratings(p_topic_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM public.topics t
     WHERE t.id = p_topic_id
       AND t.allow_ratings IS TRUE
       AND t.show_community IS TRUE
       AND (
         t.owner_id = auth.uid()
         OR t.visibility IN ('public', 'unlisted')
       )
  );
$fn$;

-- Why: previously only allow_ratings was checked by this backend function;
-- hiding Community in the UI would not have invalidated a direct, signed-in
-- request through the legitimate rating endpoint.
--
-- Verified directly on production after applying:
-- current Public works joinable = 5; anon EXECUTE=false,
-- authenticated EXECUTE=true; known Public work allowed; unknown UUID denied;
-- Private work denied without owner identity.
--
-- Rollback only if this consent rule is explicitly changed by the owner:
-- remove the "AND t.show_community IS TRUE" predicate.
-- Do not revoke authenticated EXECUTE; the rating gateway uses this helper.
