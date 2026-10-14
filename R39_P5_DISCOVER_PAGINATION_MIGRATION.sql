-- R39 P5: Public-only global Discover filtering, sorting and 12-row pagination.
-- Safe additive migration. Never change Public/Unlisted/Private data, ratings or auth.
-- SECURITY DEFINER is necessary to count submitted Community votes (rating_sets is private).
-- All access to topics and lineage below is explicitly restricted to visibility='public'.

CREATE INDEX IF NOT EXISTS topics_discover_public_published_idx
  ON public.topics (published_at DESC, id DESC)
  WHERE visibility='public';

CREATE INDEX IF NOT EXISTS topics_discover_public_remix_source_idx
  ON public.topics (source_topic_id)
  WHERE visibility='public' AND source_topic_id IS NOT NULL
    AND (snapshot #>> '{lineage,relation}') = 'remix';

CREATE OR REPLACE FUNCTION public.discover_public_works_page(
  p_view text DEFAULT 'all',
  p_category text DEFAULT 'all',
  p_sort text DEFAULT 'newest',
  p_query text DEFAULT '',
  p_limit integer DEFAULT 12,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  language_code text,
  score_scale smallint,
  weighted boolean,
  published_at timestamptz,
  snapshot_updated_at timestamptz,
  snapshot jsonb,
  source_topic_id uuid,
  show_community boolean,
  allow_ratings boolean,
  visibility text,
  participants bigint,
  remix_count bigint,
  total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF p_view NOT IN ('all','community')
    OR p_sort NOT IN ('newest','popular','community','remix')
    OR p_category NOT IN ('all','sports','manga_anime','movie_tv','food','game',
                          'music','books','travel','tech','lifestyle','other')
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 12
    OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000
    OR p_query IS NULL OR char_length(p_query)>160
  THEN
    RAISE EXCEPTION 'Invalid Discover pagination or filter arguments' USING ERRCODE='22023';
  END IF;

  RETURN QUERY
  WITH args AS (
    SELECT
      CASE WHEN pg_catalog.btrim(p_query)='' THEN ARRAY[]::text[]
      ELSE pg_catalog.regexp_split_to_array(
        pg_catalog.btrim(pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.lower(pg_catalog.normalize(p_query,NFKC)),
            '[・･／/,_-]+',' ','g'),
          '[[:space:]]+',' ','g')),' ')
      END AS terms
  ),
  eligible AS MATERIALIZED (
    SELECT t.id, t.published_at, t.snapshot_updated_at
    FROM public.topics t
    CROSS JOIN args a
    CROSS JOIN LATERAL (
      SELECT CASE WHEN t.snapshot #>> '{metadata,category}'
          IN ('sports','manga_anime','movie_tv','food','game','music',
              'books','travel','tech','lifestyle','other')
        THEN t.snapshot #>> '{metadata,category}'
        ELSE 'other' END AS cat
    ) cat
    WHERE t.visibility='public'
      AND (p_view='all' OR (t.show_community=true AND t.allow_ratings=true))
      AND (p_category='all' OR cat.cat=p_category)
      AND (
        pg_catalog.cardinality(a.terms)=0
        OR NOT EXISTS (
          SELECT 1
          FROM pg_catalog.unnest(a.terms) term
          WHERE pg_catalog.position(term IN
            pg_catalog.regexp_replace(
              pg_catalog.regexp_replace(
                pg_catalog.lower(pg_catalog.normalize(
                  pg_catalog.concat_ws(' ',
                    t.title,t.description,
                    cat.cat,
                    CASE cat.cat
                      WHEN 'sports' THEN 'スポーツ Sports'
                      WHEN 'manga_anime' THEN '漫画 アニメ Manga Anime'
                      WHEN 'movie_tv' THEN '映画 ドラマ Movies TV'
                      WHEN 'food' THEN 'フード Food'
                      WHEN 'game' THEN 'ゲーム Games'
                      WHEN 'music' THEN '音楽 Music'
                      WHEN 'books' THEN '本 文学 Books'
                      WHEN 'travel' THEN '旅行 場所 Travel Places'
                      WHEN 'tech' THEN 'テクノロジー Technology'
                      WHEN 'lifestyle' THEN 'ライフ 趣味 Lifestyle Hobbies'
                      ELSE 'その他 Other'
                    END,
                    (SELECT pg_catalog.string_agg(x.item->>'name',' ')
                       FROM pg_catalog.jsonb_array_elements(
                         CASE WHEN pg_catalog.jsonb_typeof(t.snapshot->'rows')='array'
                           THEN t.snapshot->'rows' ELSE '[]'::jsonb END) x(item)),
                    (SELECT pg_catalog.string_agg(x.item->>'name',' ')
                       FROM pg_catalog.jsonb_array_elements(
                         CASE WHEN pg_catalog.jsonb_typeof(t.snapshot->'criteria')='array'
                           THEN t.snapshot->'criteria' ELSE '[]'::jsonb END) x(item))
                  ),NFKC)),
                '[・･／/,_-]+',' ','g'),
              '[[:space:]]+',' ','g')
          )=0
        )
      )
  ),
  counted AS (
    SELECT e.id,e.published_at,e.snapshot_updated_at,
      (SELECT pg_catalog.count(*)::bigint
       FROM public.rating_sets rs
       WHERE rs.topic_id=e.id AND rs.status='submitted'
         AND EXISTS (SELECT 1 FROM public.topics tc
                     WHERE tc.id=e.id AND tc.visibility='public'
                       AND tc.show_community=true)
      ) AS participant_count,
      (SELECT pg_catalog.count(*)::bigint
       FROM public.topics child
       WHERE child.source_topic_id=e.id AND child.visibility='public'
         AND (child.snapshot #>> '{lineage,relation}')='remix'
      ) AS remix_total
    FROM eligible e
  ),
  ordered AS (
    SELECT c.*,
      pg_catalog.count(*) OVER() AS matching_total,
      pg_catalog.row_number() OVER (
        ORDER BY
          CASE WHEN p_sort='popular' THEN c.participant_count+c.remix_total END DESC NULLS LAST,
          CASE WHEN p_sort='popular' THEN c.participant_count END DESC NULLS LAST,
          CASE WHEN p_sort='community' THEN c.participant_count END DESC NULLS LAST,
          CASE WHEN p_sort='remix' THEN c.remix_total END DESC NULLS LAST,
          pg_catalog.coalesce(c.published_at,c.snapshot_updated_at) DESC NULLS LAST,
          c.id DESC
      ) AS row_rank
    FROM counted c
  )
  SELECT t.id,t.title,t.description,t.language_code,t.score_scale,t.weighted,
    t.published_at,t.snapshot_updated_at,t.snapshot,t.source_topic_id,
    t.show_community,t.allow_ratings,t.visibility,
    o.participant_count,o.remix_total,o.matching_total
  FROM ordered o
  JOIN public.topics t ON t.id=o.id AND t.visibility='public'
  ORDER BY o.row_rank
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- Function default privileges are PUBLIC unless explicitly revoked.
REVOKE ALL ON FUNCTION public.discover_public_works_page(text,text,text,text,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_public_works_page(text,text,text,text,integer,integer)
  TO anon, authenticated;
