-- R57 ISOLATED CANDIDATE, requires R57 generated search columns. DO NOT DEPLOY DIRECTLY.
-- All search terms keep original NFKC/escaped LIKE/strpos semantics; precomputed text is used instead.
-- Keep existing API signature / Public-only RLS / grants unchanged.
-- Existing function signature, grants, and Public RLS (SECURITY INVOKER) preserved.
CREATE OR REPLACE FUNCTION public.discover_public_works_v1(p_query text DEFAULT ''::text, p_category text DEFAULT 'all'::text, p_view text DEFAULT 'all'::text, p_sort text DEFAULT 'newest'::text, p_locale text DEFAULT 'ja'::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 12, p_anchor timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with args as (
  select
    greatest(coalesce(p_offset,0),0) as skip_rows,
    least(greatest(coalesce(p_limit,12),1),24) as page_size,
    coalesce(p_anchor,now()) as anchor_at,
    case when p_category in ('all','sports','manga_anime','movie_tv','food','game','music','books','travel','tech','lifestyle','other')
      then p_category else 'all' end as category,
    case when p_sort in ('newest','popular','community','remix') then p_sort else 'newest' end as sort,
    case when p_view = 'community' then 'community' else 'all' end as view,
    case when p_locale = 'en' then 'en' else 'ja' end as locale,
    trim(pg_catalog.regexp_replace(
      pg_catalog.translate(pg_catalog.lower(pg_catalog.normalize(coalesce(p_query,''),'NFKC')),
        '・/\,_-', '      '), '\s+', ' ', 'g')) as needle
),
public_only as materialized (
  select t.id,t.published_at,t.snapshot_updated_at,t.visibility
  from public.topics t cross join args a
  where t.visibility='public'
    and (t.published_at is null or t.published_at <= a.anchor_at)
    and (a.view='all' or (t.show_community=true and t.allow_ratings=true))
    -- R42: filter category before materializing large JSONB snapshots.
    and (a.category='all' or
      (case when t.snapshot#>>'{metadata,category}' in
        ('sports','manga_anime','movie_tv','food','game','music','books','travel','tech','lifestyle','other')
       then t.snapshot#>>'{metadata,category}' else 'other' end)=a.category)
    -- The first full normalized term activates the locale's trigram index.
    -- Every remaining term is verified below with literal strpos semantics.
    and (a.needle='' or
      (a.locale='ja' and
        t.discover_search_text_ja
          like '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
          pg_catalog.split_part(a.needle,' ',1),'!','!!'),'%','!%'),'_','!_') || '%' escape '!')
      or (a.locale='en' and
        t.discover_search_text_en
          like '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
          pg_catalog.split_part(a.needle,' ',1),'!','!!'),'%','!%'),'_','!_') || '%' escape '!')
    )
    -- R56: The first term has ALREADY been fully verified by escaped LIKE
    -- above, including literal '%' and '_' handling. Rechecking it with
    -- another normalized JSONB search blob costs a second normalization for
    -- every matching candidate, especially on one-word queries.
    -- Only require the remaining terms. For a single normalized term this
    -- subquery is empty, avoiding all redundant blob computation.
    and (a.needle='' or not exists (
      select 1 from pg_catalog.unnest(pg_catalog.string_to_array(a.needle,' '))
        with ordinality as term(word,term_ord)
      where term.term_ord > 1
        and pg_catalog.strpos(
          (case when a.locale='ja' then t.discover_search_text_ja else t.discover_search_text_en end),
          term.word)=0
    ))
),
filtered as materialized (
  select b.* from public_only b
),
with_counts as materialized (
  select b.*,
    case when a.sort in ('popular','community')
      then public.discover_public_participant_count_v1(b.id) else 0::bigint end as participant_rank,
    case when a.sort in ('popular','remix')
      then public.discover_public_remix_count_v1(b.id)
      else 0::bigint end as remix_rank
  from filtered b cross join args a
),
ranked as (
  select c.*,
    pg_catalog.row_number() over(
      order by
        case when a.sort='popular' then c.participant_rank+c.remix_rank end desc nulls last,
        case when a.sort in ('popular','community') then c.participant_rank end desc nulls last,
        case when a.sort in ('popular','remix') then c.remix_rank end desc nulls last,
        coalesce(c.published_at,c.snapshot_updated_at,'epoch'::timestamptz) desc,
        c.id asc
    ) as rn
  from with_counts c cross join args a
),
page as materialized (
  select r.* from ranked r cross join args a
  where r.rn > a.skip_rows and r.rn <= a.skip_rows+a.page_size
  order by r.rn
)
select pg_catalog.jsonb_build_object(
  'rows',coalesce(
    (select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id',p.id,'title',t.title,'description',t.description,
        'language_code',t.language_code,'score_scale',t.score_scale,'weighted',t.weighted,
        'published_at',p.published_at,'snapshot_updated_at',t.snapshot_updated_at,
        'snapshot',t.snapshot,'source_topic_id',t.source_topic_id,
        'show_community',t.show_community,'allow_ratings',t.allow_ratings,
        'visibility',p.visibility,
        'participants',case when a.sort in ('popular','community') then p.participant_rank
                           else public.discover_public_participant_count_v1(p.id) end,
        'remixCount',case when a.sort in ('popular','remix') then p.remix_rank
                         else public.discover_public_remix_count_v1(p.id)
                     end
      ) order by p.rn
    ) from page p cross join args a join public.topics t on t.id=p.id and t.visibility='public'),'[]'::jsonb),
  'total',(select count(*)::bigint from filtered),
  'has_more',(select count(*)::bigint from filtered) > (select a.skip_rows+a.page_size from args a),
  'anchor',(select a.anchor_at from args a)
);
$function$
;
