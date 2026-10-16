-- R63 only disposable PostgreSQL. Existing fixture already installs R57 RPC.
\set ON_ERROR_STOP on
\echo R63: capture exact R57 JSON for 28 query/pagination cases
CREATE TEMP TABLE r63_test_inputs(
 code text PRIMARY KEY, q text, category text, view_mode text, sort_mode text,
 locale text, offset_n int
);
INSERT INTO r63_test_inputs VALUES
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

INSERT INTO r63_test_inputs VALUES
('remix_sort','サッカー','all','all','remix','ja',0),
('community_empty','','all','community','community','ja',0),
('popular_empty','','all','all','popular','en',0),
('newest_page2','','all','all','newest','en',12);
CREATE TEMP TABLE r63_expected AS
SELECT i.code,
  public.discover_public_works_v1(
    i.q,i.category,i.view_mode,i.sort_mode,i.locale,i.offset_n,12,
    '2026-10-16 00:00:00+00'::timestamptz) AS data
FROM r63_test_inputs i;
\echo R63: install paired-count helper and RPC in disposable database
\i R63_PUBLIC_SET_COUNTS_HELPER.sql
\i R63_PUBLIC_SET_COUNTS_RPC_CANDIDATE.sql
DO $parity$
DECLARE mismatches integer;
BEGIN
  SELECT count(*) INTO mismatches
  FROM r63_test_inputs i JOIN r63_expected e ON e.code=i.code
  WHERE e.data IS DISTINCT FROM public.discover_public_works_v1(
    i.q,i.category,i.view_mode,i.sort_mode,i.locale,i.offset_n,12,
    '2026-10-16 00:00:00+00'::timestamptz);
  IF mismatches>0 THEN RAISE EXCEPTION
    'R63 exact JSON regression: % of 32 cases changed',mismatches; END IF;
END $parity$;
\echo R63: 32/32 full JSON EXACT parity PASS
\echo R63: compare every Public count with the old scalar helpers and test nonpublic exclusion
DO $counts$
DECLARE mismatches integer;
BEGIN
 SELECT count(*) INTO mismatches
 FROM public.topics t
 LEFT JOIN public.discover_public_rank_rows_v1() r ON r.topic_id=t.id
 WHERE (t.visibility='public' AND
        (r.topic_id IS NULL OR r.participants IS DISTINCT FROM public.discover_public_participant_count_v1(t.id)
         OR r.remixes IS DISTINCT FROM public.discover_public_remix_count_v1(t.id)))
   OR (t.visibility<>'public' AND r.topic_id IS NOT NULL);
 IF mismatches <> 0 THEN
   RAISE EXCEPTION 'R63 Set helper private leak / mismatched counters: %',mismatches;
 END IF;
 IF (SELECT count(*) FROM public.discover_public_rank_rows_v1())<>
    (SELECT count(*) FROM public.topics WHERE visibility='public') THEN
    RAISE EXCEPTION 'R63 Published helper rowcount wrong';
 END IF;
END $counts$;
\echo R63: set helper matches ALL published works and suppresses Private/Unlisted
\echo R63: update visibility on disposable fixture to prove revocation
DO $revoke$
DECLARE marker uuid;
BEGIN
 SELECT id INTO marker FROM public.topics WHERE visibility='public' LIMIT 1;
 UPDATE public.topics SET visibility='private' WHERE id=marker;
 IF EXISTS(SELECT 1 FROM public.discover_public_rank_rows_v1() WHERE topic_id=marker) THEN
  RAISE EXCEPTION 'R63 Revocation leak after changing Public -> Private';
 END IF;
 UPDATE public.topics SET visibility='public' WHERE id=marker;
END $revoke$;
\echo R63: Public -> Private count revocation PASS
\echo R63: test a Private marker and no Unlisted ids as anon
SET ROLE anon;
DO $safe$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(
      public.discover_public_works_v1('R58_P4_PRIVATE_HIDDEN_MARKER','all','all','newest','en',0,12,
       '2026-10-16 00:00:00+00'::timestamptz)->'rows'
    ) item
  ) THEN RAISE EXCEPTION 'Private marker leaked'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(
      public.discover_public_works_v1('','all','all','newest','en',0,12,
       '2026-10-16 00:00:00+00'::timestamptz)->'rows'
    ) item WHERE item->>'visibility'<>'public'
  ) THEN RAISE EXCEPTION 'Unlisted/Private visible'; END IF;
END $safe$;
RESET ROLE;
\echo R63: Private/Unlisted isolation PASS
\echo R63: EXPLAIN new popular / Japanese 1-character / newest
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 'hero','all','all','popular','en',0,12,'2026-10-16 00:00:00+00'::timestamptz);
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 'サ','all','all','newest','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz);
EXPLAIN (ANALYZE, BUFFERS) SELECT public.discover_public_works_v1(
 '','all','all','newest','ja',0,12,'2026-10-16 00:00:00+00'::timestamptz);
\echo R63 all cases passed in isolated DB
