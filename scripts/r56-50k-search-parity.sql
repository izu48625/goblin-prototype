-- R56 isolated 50k-works: exact semantic parity and per-query isolated timing.
-- Existing R53 fixture is installed before this file; never run on production.
\set ON_ERROR_STOP on
\echo R56 install CURRENT production-version R53/R54 for baseline
\i R53_DISCOVER_LATE_HYDRATION_CANDIDATE.sql
CREATE TEMP TABLE r56_test_inputs(
 code text PRIMARY KEY, q text, category text, view_mode text, sort_mode text,
 locale text, offset_n int
);
INSERT INTO r56_test_inputs VALUES
('ja_single','サッカー','all','all','newest','ja',0),
('ja_single_popular','サッカー','all','all','popular','ja',0),
('ja_single_community','サッカー','all','community','community','ja',0),
('ja_single_remix','サッカー','all','all','remix','ja',0),
('ja_one_char','サ','all','all','newest','ja',0),
('ja_one_char_sports','サ','sports','all','newest','ja',0),
('ja_multiterm','サッカー 日本チーム','all','all','newest','ja',0),
('ja_multiterm_absent','サッカー unicorn','all','all','newest','ja',0),
('ja_separator','サッカー・日本チーム','all','all','newest','ja',0),
('ja_whitespace','  サッカー     日本チーム  ','all','all','newest','ja',0),
('ja_escaped_percent','サッカー%','all','all','newest','ja',0),
('ja_escaped_underscore','サッカー_','all','all','newest','ja',0),
('ja_escaped_bang','サッカー!','all','all','newest','ja',0),
('ja_page_2','サッカー','all','all','newest','ja',12),
('ja_page_100','サッカー','all','all','popular','ja',1200),
('ja_page_end','サッカー','all','all','newest','ja',999999),
('en_single','hero','all','all','newest','en',0),
('en_single_popular','hero','all','all','popular','en',0),
('en_one_char','h','all','all','newest','en',0),
('en_multiterm','hero technical','all','all','newest','en',0),
('en_multiterm_absent','hero unicorn','all','all','popular','en',0),
('en_literal_percent','hero%','all','all','newest','en',0),
('en_literal_underscore','hero_','all','all','newest','en',0),
('en_large_offset','hero','all','all','popular','en',1200),
('empty_ja','','all','all','newest','ja',0),
('empty_en','','all','all','popular','en',0),
('category_sports','サッカー','sports','all','popular','ja',0),
('community_only','サッカー','sports','community','community','ja',0);
CREATE TEMP TABLE r56_expected AS
SELECT i.code,public.discover_public_works_v1(
 i.q,i.category,i.view_mode,i.sort_mode,i.locale,i.offset_n,12,
 '2026-10-16 00:00:00+00'::timestamptz) AS data
FROM r56_test_inputs i;
\echo R56 BEFORE Japanese high-match query
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 'サッカー','all','all','newest','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz);
\echo R56 BEFORE Japanese two-term query
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 'サッカー 日本チーム','all','all','newest','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz);
\echo R56 BEFORE English high-match query
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 'hero','all','all','popular','en',0,12,'2026-10-16 00:00:00+00'::timestamptz);
\echo R56 candidate installs on isolated PostgreSQL
\i R56_DISCOVER_SINGLE_TERM_CANDIDATE.sql
DO $check$
DECLARE mismatches int;
BEGIN
 SELECT count(*) INTO mismatches
 FROM r56_expected e JOIN r56_test_inputs i ON i.code=e.code
 WHERE e.data IS DISTINCT FROM public.discover_public_works_v1(
   i.q,i.category,i.view_mode,i.sort_mode,i.locale,i.offset_n,12,
   '2026-10-16 00:00:00+00'::timestamptz);
 IF mismatches<>0 THEN RAISE EXCEPTION 'R56 parity FAILED: % mismatches',mismatches; END IF;
END $check$;
\echo R56 AFTER Japanese high-match query
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 'サッカー','all','all','newest','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz);
\echo R56 AFTER Japanese two-term query
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 'サッカー 日本チーム','all','all','newest','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz);
\echo R56 AFTER English high-match query
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 'hero','all','all','popular','en',0,12,'2026-10-16 00:00:00+00'::timestamptz);
SET ROLE anon;
DO $privacy$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(
 public.discover_public_works_v1('サッカー','all','all','newest','ja',0,12,
 '2026-10-16 00:00:00+00'::timestamptz)->'rows') AS t(value)
 WHERE t.value->>'visibility'<>'public')
 THEN RAISE EXCEPTION 'R56 private or unlisted leaked';END IF;
END $privacy$;
RESET ROLE;
\echo R56 28-condition exact JSON parity, 50k rows, anon Public-only PASS
