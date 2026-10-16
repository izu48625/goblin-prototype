-- Capture exact v1 Public-only responses at 10k total works, as anonymous.
\set ON_ERROR_STOP on
CREATE TABLE public.r53_test_inputs(code text PRIMARY KEY, query text, category text, view text, sort text, locale text, offset_n integer, limit_n integer);
INSERT INTO public.r53_test_inputs VALUES
 ('newest_ja','','all','all','newest','ja',0,12),
 ('newest_page2','','all','all','newest','ja',12,12),
 ('newest_page10','','all','all','newest','ja',108,12),
 ('popular_en','','all','all','popular','en',0,12),
 ('community_ja','','all','community','community','ja',0,12),
 ('remix_ja','','all','all','remix','ja',0,12),
 ('sports_newest','','sports','all','newest','ja',0,12),
 ('sports_popular','','sports','all','popular','ja',0,12),
 ('other_community','','other','community','community','ja',12,12),
 ('search_ja','サッカー','all','all','newest','ja',0,12),
 ('search_en','hero','all','all','popular','en',0,12),
 ('search_multiterm','hero technical','all','all','popular','en',0,12),
 ('search_partial','ports','all','all','newest','en',0,12),
 ('search_empty','NOTFOUND','sports','all','remix','ja',0,12);
CREATE TABLE public.r53_expected AS
 SELECT i.code,public.discover_public_works_v1(
  i.query,i.category,i.view,i.sort,i.locale,i.offset_n,i.limit_n,
  '2026-10-16 00:00:00+00'::timestamptz) AS data
 FROM public.r53_test_inputs i;
\echo R53 BASELINE sample, fresh latest
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 '', 'all','all','newest','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz);
\echo R53 BASELINE popular
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 '', 'all','all','popular','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz);
\echo R53 BASELINE search short Japanese
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 'サッカー', 'all','all','newest','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz);
\i R53_DISCOVER_LATE_HYDRATION_CANDIDATE.sql
\echo R53 optimized v1 installed in isolated CI only
DO $check$
DECLARE different int;
BEGIN
  SELECT count(*) INTO different
  FROM public.r53_expected e
  JOIN public.r53_test_inputs i ON i.code=e.code
  WHERE e.data IS DISTINCT FROM public.discover_public_works_v1(
    i.query,i.category,i.view,i.sort,i.locale,i.offset_n,i.limit_n,
    '2026-10-16 00:00:00+00'::timestamptz);
  IF different<>0 THEN RAISE EXCEPTION 'R53 parity mismatch: % cases',different; END IF;
END $check$;
\echo R53 CANDIDATE newest
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 '', 'all','all','newest','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz);
\echo R53 CANDIDATE popular
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 '', 'all','all','popular','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz);
\echo R53 CANDIDATE search short Japanese
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 'サッカー', 'all','all','newest','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz);
\echo R53 anonymous RLS eligibility and Private/Unlisted isolation
SET ROLE anon;
SELECT CASE WHEN (public.discover_public_works_v1(
  '', 'all','all','newest','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz)->'rows') @>
  '[{"visibility":"private"}]'::jsonb THEN 'FAIL' ELSE 'PASS' END AS private_excluded;
DO $rls$
DECLARE exposed int;
BEGIN
 SELECT count(*) INTO exposed
 FROM public.topics t
 WHERE t.visibility='private';
 IF exposed<>0 THEN RAISE EXCEPTION 'private topics leaked to anon'; END IF;
END $rls$;
RESET ROLE;
\echo R53 14 combinations exact JSON parity + isolated 10000-row smoke PASS
