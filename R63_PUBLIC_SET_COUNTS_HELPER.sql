-- R63: EXPERIMENT ONLY. Production cutover requires independent security audit.
-- Returns ONLY Public topic UUID + counts that are already individually public
-- through discover_public_participant_count_v1/remix_count_v1.
-- This is a bulk API surface, so evaluate enumeration / abuse risk before deploy.
CREATE OR REPLACE FUNCTION public.discover_public_rank_rows_v1()
RETURNS TABLE(topic_id uuid, participants bigint, remixes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT t.id,
         CASE WHEN t.show_community IS TRUE
              THEN COALESCE(c.participants,0)::bigint ELSE 0::bigint END,
         COALESCE(c.remixes,0)::bigint
  FROM public.topics AS t
  LEFT JOIN private.discover_counters AS c ON c.topic_id=t.id
  WHERE t.visibility='public';
$function$;
REVOKE ALL ON FUNCTION public.discover_public_rank_rows_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.discover_public_rank_rows_v1() FROM anon;
GRANT EXECUTE ON FUNCTION public.discover_public_rank_rows_v1() TO anon;
DO $grant_auth$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.discover_public_rank_rows_v1() TO authenticated';
 END IF;
END $grant_auth$;
