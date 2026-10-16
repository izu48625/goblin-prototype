-- R60 candidate only: isolated PostgreSQL first, not automatic production deployment.
-- This helper returns the same PUBLIC-only counts as the two existing single-value
-- functions, but uses one authorized topics lookup and one counters lookup.
-- Nonpublic/nonexistent topic IDs return [0,0]. Never disclose unpublished counts.
CREATE OR REPLACE FUNCTION public.discover_public_rank_pair_v1(p_topic_id uuid)
RETURNS bigint[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
SELECT COALESCE((
    SELECT ARRAY[
       CASE WHEN t.show_community IS TRUE THEN COALESCE(c.participants, 0)::bigint ELSE 0::bigint END,
       COALESCE(c.remixes, 0)::bigint
    ]::bigint[]
    FROM public.topics AS t
    LEFT JOIN private.discover_counters AS c ON c.topic_id=t.id
    WHERE t.id=p_topic_id AND t.visibility='public'
), ARRAY[0::bigint,0::bigint]);
$function$;
-- SECURITY DEFINER is required only to read the existing private counters.
-- No PUBLIC implicit EXECUTE. The existing single-id counter helpers already
-- expose these two PUBLIC-only values; the helper does not take bulk UUID arrays.
REVOKE ALL ON FUNCTION public.discover_public_rank_pair_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.discover_public_rank_pair_v1(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.discover_public_rank_pair_v1(uuid) TO anon;
-- Supabase front-end clients can also access published Discover via authenticated role.
DO $check_role$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
   EXECUTE 'GRANT EXECUTE ON FUNCTION public.discover_public_rank_pair_v1(uuid) TO authenticated';
 END IF;
END $check_role$;
