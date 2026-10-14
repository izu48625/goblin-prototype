-- R40 Discover: read-only, public-only, globally ranked 12-work pages.
-- Install after reviewing existing RLS and count semantics. No stored user data is mutated.
-- SECURITY INVOKER means topics RLS remains in force.
create or replace function public.discover_public_works_v1(
  p_query text default '',
  p_category text default 'all',
  p_view text default 'all',
  p_sort text default 'newest',
  p_locale text default 'ja',
  p_offset integer default 0,
  p_limit integer default 12,
  p_anchor timestamptz default null
)
returns jsonb
language sql
stable security invoker
set search_path = ''
as $function$
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
  select t.id,t.title,t.description,t.language_code,t.score_scale,t.weighted,
    t.published_at,t.snapshot_updated_at,t.snapshot,t.source_topic_id,
    t.show_community,t.allow_ratings,t.visibility,
    case when t.snapshot#>>'{metadata,category}' in
      ('sports','manga_anime','movie_tv','food','game','music','books','travel','tech','lifestyle','other')
      then t.snapshot#>>'{metadata,category}' else 'other' end as category
  from public.topics t cross join args a
  where t.visibility='public'
    and (t.published_at is null or t.published_at <= a.anchor_at)
    and (a.view='all' or (t.show_community=true and t.allow_ratings=true))
    -- R42: filter category before materializing large JSONB snapshots.
    and (a.category='all' or
      (case when t.snapshot#>>'{metadata,category}' in
        ('sports','manga_anime','movie_tv','food','game','music','books','travel','tech','lifestyle','other')
       then t.snapshot#>>'{metadata,category}' else 'other' end)=a.category)
),
filtered as materialized (
  select b.* from public_only b cross join args a
  where (a.category='all' or b.category=a.category)
    and (a.needle='' or not exists (
      select 1 from pg_catalog.unnest(pg_catalog.string_to_array(a.needle,' ')) as term(word)
      where pg_catalog.strpos(
        trim(pg_catalog.regexp_replace(
          pg_catalog.translate(pg_catalog.lower(pg_catalog.normalize(
            pg_catalog.concat_ws(' ',b.title,b.description,
              case b.category
                when 'sports' then case when a.locale='ja' then 'スポーツ' else 'Sports' end
                when 'manga_anime' then case when a.locale='ja' then '漫画・アニメ' else 'Manga / Anime' end
                when 'movie_tv' then case when a.locale='ja' then '映画・ドラマ' else 'Movies / TV' end
                when 'food' then case when a.locale='ja' then 'フード' else 'Food' end
                when 'game' then case when a.locale='ja' then 'ゲーム' else 'Games' end
                when 'music' then case when a.locale='ja' then '音楽' else 'Music' end
                when 'books' then case when a.locale='ja' then '本・文学' else 'Books' end
                when 'travel' then case when a.locale='ja' then '旅行・場所' else 'Travel / Places' end
                when 'tech' then case when a.locale='ja' then 'テクノロジー' else 'Technology' end
                when 'lifestyle' then case when a.locale='ja' then 'ライフ・趣味' else 'Lifestyle / Hobbies' end
                else case when a.locale='ja' then 'その他' else 'Other' end
              end,
              (select pg_catalog.string_agg(e.value->>'name',' ')
               from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(b.snapshot->'rows')='array'
                 then b.snapshot->'rows' else '[]'::jsonb end) as e(value)),
              (select pg_catalog.string_agg(e.value->>'name',' ')
               from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(b.snapshot->'criteria')='array'
                 then b.snapshot->'criteria' else '[]'::jsonb end) as e(value))
            ),'NFKC')), '・/\,_-', '      '), '\s+', ' ', 'g')),
        term.word)=0
    ))
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
        'id',p.id,'title',p.title,'description',p.description,
        'language_code',p.language_code,'score_scale',p.score_scale,'weighted',p.weighted,
        'published_at',p.published_at,'snapshot_updated_at',p.snapshot_updated_at,
        'snapshot',p.snapshot,'source_topic_id',p.source_topic_id,
        'show_community',p.show_community,'allow_ratings',p.allow_ratings,
        'visibility',p.visibility,
        'participants',case when a.sort in ('popular','community') then p.participant_rank
                           else public.discover_public_participant_count_v1(p.id) end,
        'remixCount',case when a.sort in ('popular','remix') then p.remix_rank
                         else public.discover_public_remix_count_v1(p.id)
                     end
      ) order by p.rn
    ) from page p cross join args a),'[]'::jsonb),
  'total',(select count(*)::bigint from filtered),
  'has_more',(select count(*)::bigint from filtered) > (select a.skip_rows+a.page_size from args a),
  'anchor',(select a.anchor_at from args a)
);
$function$;

-- R41 reuses the R40 function signature and relies on R41 counter readers.
