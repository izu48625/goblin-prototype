-- R53 isolated DB fixture: NEVER connect this file to production Supabase.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA IF NOT EXISTS private;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE public.topics (
 id uuid PRIMARY KEY,
 title text NOT NULL,
 description text,
 language_code text,
 score_scale integer DEFAULT 100,
 weighted boolean DEFAULT false,
 published_at timestamptz,
 snapshot_updated_at timestamptz,
 snapshot jsonb NOT NULL,
 source_topic_id uuid,
 show_community boolean DEFAULT false,
 allow_ratings boolean DEFAULT false,
 visibility text NOT NULL
);
CREATE TABLE private.discover_counters (
 topic_id uuid PRIMARY KEY REFERENCES public.topics(id),
 participants bigint NOT NULL DEFAULT 0,
 remixes bigint NOT NULL DEFAULT 0
);
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_view ON public.topics FOR SELECT TO anon USING (visibility IN ('public','unlisted'));
GRANT SELECT ON public.topics TO anon;
CREATE OR REPLACE FUNCTION public.discover_public_participant_count_v1(p_topic_id uuid)
 RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM public.topics t
  WHERE t.id=p_topic_id AND t.visibility='public' AND t.show_community=true)
 THEN coalesce((SELECT participants FROM private.discover_counters WHERE topic_id=p_topic_id),0)
 ELSE 0::bigint END;
 $$;
CREATE OR REPLACE FUNCTION public.discover_public_remix_count_v1(p_topic_id uuid)
 RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM public.topics t
  WHERE t.id=p_topic_id AND t.visibility='public')
 THEN coalesce((SELECT remixes FROM private.discover_counters WHERE topic_id=p_topic_id),0)
 ELSE 0::bigint END;
 $$;
\i scripts/r53-search-blob-fixture.sql
INSERT INTO public.topics(
 id,title,description,language_code,score_scale,weighted,
 published_at,snapshot_updated_at,snapshot,source_topic_id,
 show_community,allow_ratings,visibility
)
SELECT ('00000000-0000-4000-8000-'||lpad(to_hex(g),12,'0'))::uuid,
 CASE WHEN g%2=0 THEN 'サッカー 選手'||g ELSE 'Sports Player '||g END,
 CASE WHEN g%7=0 THEN 'fast technical hero' ELSE 'performance rating' END,
 CASE WHEN g%2=0 THEN 'ja' ELSE 'en' END,
 CASE WHEN g%3=0 THEN 10 ELSE 100 END,
 g%4=0,
 CASE WHEN g%400=0 THEN NULL ELSE '2026-10-01 00:00:00+00'::timestamptz+g*interval '1 second' END,
 '2026-10-02 00:00:00+00'::timestamptz,
 jsonb_build_object(
  'metadata',jsonb_build_object('category',
      CASE g%5 WHEN 0 THEN 'sports' WHEN 1 THEN 'game' WHEN 2 THEN 'manga_anime' WHEN 3 THEN 'movie_tv' ELSE 'other' END),
  'rows',jsonb_build_array(
    jsonb_build_object('name',CASE WHEN g%2=0 THEN '日本チーム' ELSE 'Team Hero' END,
      'note',repeat('A',1800),'scores',jsonb_build_array(70,82,98)),
    jsonb_build_object('name','Target team','scores',jsonb_build_array(30,40,50))),
  'criteria',jsonb_build_array(jsonb_build_object('name','速さ'),
                              jsonb_build_object('name','skill'),
                              jsonb_build_object('name','耐久')))
 ,null,g%3=0,g%3=0,
 CASE WHEN g%17=0 THEN 'private' WHEN g%13=0 THEN 'unlisted' ELSE 'public' END
FROM generate_series(1,10000) AS g;
INSERT INTO private.discover_counters(topic_id,participants,remixes)
SELECT id, ((('x'||right(replace(id::text,'-',''),4))::bit(16)::integer)%80)::bigint,
       ((('x'||right(replace(id::text,'-',''),4))::bit(16)::integer)%5)::bigint
FROM public.topics;
CREATE INDEX ON public.topics(published_at DESC,id) WHERE visibility='public';
CREATE INDEX ON public.topics USING gin(public.discover_search_blob_v1(title,description,snapshot,'ja') gin_trgm_ops)
 WHERE visibility='public';
CREATE INDEX ON public.topics USING gin(public.discover_search_blob_v1(title,description,snapshot,'en') gin_trgm_ops)
 WHERE visibility='public';
ANALYZE public.topics;
\i scripts/r53-baseline-live-discover.sql
GRANT EXECUTE ON FUNCTION public.discover_public_works_v1(text,text,text,text,text,integer,integer,timestamptz) TO anon;
\echo R53 isolated 10000 topics fixture loaded; baseline function installed
