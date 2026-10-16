-- Dedicated EMPTY internal schema (not the existing private schema).
-- The ability to reference an unexposed helper from a SECURITY INVOKER SQL
-- function requires USAGE + EXECUTE on this one schema/function.
-- Neither tables nor arbitrary routines are granted. No schema CREATE permission.
CREATE SCHEMA IF NOT EXISTS discover_internal;
REVOKE ALL ON SCHEMA discover_internal FROM PUBLIC;
REVOKE ALL ON SCHEMA discover_internal FROM anon, authenticated;
GRANT USAGE ON SCHEMA discover_internal TO anon, authenticated;
-- Keep future functions inaccessible by default in this namespace.
-- Only the exact function below gets explicit execute permissions.
-- R64 CANDIDATE: helper lives only in a non-exposed internal schema.
-- Returns ONLY Public topic UUID + counts that are already individually public
-- through discover_public_participant_count_v1/remix_count_v1.
-- This schema MUST NEVER be added to PostgREST/GraphQL Exposed schemas.
CREATE OR REPLACE FUNCTION discover_internal.discover_public_rank_rows_v1()
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
REVOKE ALL ON FUNCTION discover_internal.discover_public_rank_rows_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION discover_internal.discover_public_rank_rows_v1() FROM anon;
GRANT EXECUTE ON FUNCTION discover_internal.discover_public_rank_rows_v1() TO anon;
DO $grant_auth$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  EXECUTE 'GRANT EXECUTE ON FUNCTION discover_internal.discover_public_rank_rows_v1() TO authenticated';
 END IF;
END $grant_auth$;
