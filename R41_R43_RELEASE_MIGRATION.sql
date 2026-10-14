-- R41-R43 one-transaction cutover; Public-only API and no new paid services.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- R41_DISCOVER_COUNTERS.sql
-- R41: atomic, incremental Discover counters, hidden from Data API.
-- Evaluated inside BEGIN/ROLLBACK first; only migrate with lifecycle/concurrency QA.
create schema if not exists private;
create table if not exists private.discover_counters (
  topic_id uuid primary key references public.topics(id) on delete cascade,
  participants bigint not null default 0 check (participants >= 0),
  remixes bigint not null default 0 check (remixes >= 0)
);
revoke all on private.discover_counters from public, anon, authenticated;
alter table private.discover_counters enable row level security;

-- Applying a delta to a single row is atomic: no read-count/write-count race.
-- Positive deltas require an extant topic via FK; negative deltas never
-- recreate a topic that is concurrently being deleted.
create or replace function private.discover_counter_delta(
 p_topic_id uuid, p_participants bigint default 0, p_remixes bigint default 0
) returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_topic_id is null or (p_participants=0 and p_remixes=0) then return; end if;
 if p_participants > 0 or p_remixes > 0 then
   insert into private.discover_counters(topic_id,participants,remixes)
   values(p_topic_id,greatest(0,p_participants),greatest(0,p_remixes))
   on conflict(topic_id) do update set
    participants=greatest(0,private.discover_counters.participants + p_participants),
    remixes=greatest(0,private.discover_counters.remixes + p_remixes);
 else
   update private.discover_counters set
     participants=greatest(0,participants + p_participants),
     remixes=greatest(0,remixes + p_remixes)
   where topic_id=p_topic_id;
 end if;
end;
$$;
revoke all on function private.discover_counter_delta(uuid,bigint,bigint)
 from public,anon,authenticated;

-- Counts submitted ratings independent of visibility. The public-facing
-- reader enforces current Public visibility + show_community at read time.
create or replace function private.discover_rating_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
   if new.status='submitted' then
     perform private.discover_counter_delta(new.topic_id,1,0);
   end if;
   return new;
 elsif tg_op='DELETE' then
   if old.status='submitted' then
     perform private.discover_counter_delta(old.topic_id,-1,0);
   end if;
   return old;
 else
   if old.topic_id is distinct from new.topic_id then
     if old.status='submitted' then
       perform private.discover_counter_delta(old.topic_id,-1,0);
     end if;
     if new.status='submitted' then
       perform private.discover_counter_delta(new.topic_id,1,0);
     end if;
   elsif old.status is distinct from new.status then
     perform private.discover_counter_delta(new.topic_id,
       case when new.status='submitted' then 1 else -1 end,0);
   end if;
   return new;
 end if;
end;
$$;
revoke all on function private.discover_rating_changed() from public,anon,authenticated;

create or replace function private.discover_topic_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 old_parent uuid;
 new_parent uuid;
begin
 if tg_op='INSERT' then
   insert into private.discover_counters(topic_id,participants,remixes)
     values(new.id,0,0) on conflict(topic_id) do nothing;
   old_parent:=null;
 elsif tg_op='UPDATE' then
   old_parent:=case when old.visibility='public'
    and pg_catalog.lower(coalesce(old.snapshot#>>'{lineage,relation}',''))='remix'
    then old.source_topic_id else null end;
 else
   old_parent:=case when old.visibility='public'
    and pg_catalog.lower(coalesce(old.snapshot#>>'{lineage,relation}',''))='remix'
    then old.source_topic_id else null end;
 end if;

 if tg_op<>'DELETE' then
   new_parent:=case when new.visibility='public'
    and pg_catalog.lower(coalesce(new.snapshot#>>'{lineage,relation}',''))='remix'
    then new.source_topic_id else null end;
 else
   new_parent:=null;
 end if;

 if old_parent is distinct from new_parent then
   if old_parent is not null then
     perform private.discover_counter_delta(old_parent,0,-1);
   end if;
   if new_parent is not null then
     perform private.discover_counter_delta(new_parent,0,1);
   end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function private.discover_topic_changed() from public,anon,authenticated;

-- Lock writers while backfilling to keep the initial snapshot consistent.
-- Existing contents of topics/rating_sets are never modified.
lock table public.topics in share row exclusive mode;
lock table public.rating_sets in share row exclusive mode;
drop trigger if exists r41_discover_rating_counter on public.rating_sets;
create trigger r41_discover_rating_counter
after insert or update of status,topic_id or delete on public.rating_sets
for each row execute function private.discover_rating_changed();
drop trigger if exists r41_discover_topic_counter on public.topics;
create trigger r41_discover_topic_counter
after insert or update of visibility,source_topic_id,snapshot or delete on public.topics
for each row execute function private.discover_topic_changed();

insert into private.discover_counters(topic_id,participants,remixes)
select t.id,
 (select count(*) from public.rating_sets r where r.topic_id=t.id and r.status='submitted'),
 (select count(*) from public.topics ch where ch.source_topic_id=t.id
   and ch.visibility='public'
   and pg_catalog.lower(coalesce(ch.snapshot#>>'{lineage,relation}',''))='remix')
from public.topics t
on conflict(topic_id) do update set
 participants=excluded.participants,remixes=excluded.remixes;

-- R41_DISCOVER_COUNTER_READERS.sql
-- R41: dedicated Discover-only private counter readers.
-- Do NOT replace public.get_topic_participant_count(uuid) used elsewhere.
create or replace function public.discover_public_participant_count_v1(p_topic_id uuid)
returns bigint language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.topics t
 where t.id=p_topic_id and t.visibility='public' and t.show_community=true)
 then coalesce((select participants from private.discover_counters where topic_id=p_topic_id),0)
 else 0::bigint end
$$;
revoke all on function public.discover_public_participant_count_v1(uuid) from public,anon,authenticated;
grant execute on function public.discover_public_participant_count_v1(uuid) to anon,authenticated;

create or replace function public.discover_public_remix_count_v1(p_topic_id uuid)
returns bigint language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.topics t where t.id=p_topic_id and t.visibility='public')
 then coalesce((select remixes from private.discover_counters where topic_id=p_topic_id),0)
 else 0::bigint end
$$;
revoke all on function public.discover_public_remix_count_v1(uuid) from public,anon,authenticated;
grant execute on function public.discover_public_remix_count_v1(uuid) to anon,authenticated;

-- R42_DISCOVER_CATEGORY_INDEX.sql
-- R42: light indexes for Public-only Discover filtering.
-- Search RPC remains compatible and is NOT changed in this stage.
-- Category expression index will be usable by a future predicate pushdown query.
create index if not exists topics_discover_public_category_idx
on public.topics ((case when snapshot#>>'{metadata,category}' in
 ('sports','manga_anime','movie_tv','food','game','music','books','travel','tech','lifestyle','other')
 then snapshot#>>'{metadata,category}' else 'other' end),published_at desc,id)
where visibility='public';

-- R42: No new extension, external search service, table exposure, or pay-per-query provider.
-- Full NFKC substring search includes JSON arrays; do not claim that an
-- expression index on title alone would accelerate the current predicate.

-- R42_DISCOVER_TRIGRAM_SEARCH.sql
-- R42: immutable NFKC/JA+EN search projection on the Public topics table.
-- This contains only caller-supplied fields; it reads no database records.
-- Data API still observes topics RLS and visibility='public'.
create extension if not exists pg_trgm with schema extensions;

create or replace function public.discover_search_blob_v1(
 p_title text, p_description text, p_snapshot jsonb, p_locale text
) returns text language sql immutable set search_path='' as $$
select pg_catalog.btrim(pg_catalog.regexp_replace(
 pg_catalog.translate(pg_catalog.lower(pg_catalog.normalize(
   pg_catalog.concat_ws(' ',p_title,p_description,
     case (case when p_snapshot#>>'{metadata,category}' in
       ('sports','manga_anime','movie_tv','food','game','music','books','travel','tech','lifestyle','other')
       then p_snapshot#>>'{metadata,category}' else 'other' end)
       when 'sports' then case when p_locale='ja' then 'スポーツ' else 'Sports' end
       when 'manga_anime' then case when p_locale='ja' then '漫画・アニメ' else 'Manga / Anime' end
       when 'movie_tv' then case when p_locale='ja' then '映画・ドラマ' else 'Movies / TV' end
       when 'food' then case when p_locale='ja' then 'フード' else 'Food' end
       when 'game' then case when p_locale='ja' then 'ゲーム' else 'Games' end
       when 'music' then case when p_locale='ja' then '音楽' else 'Music' end
       when 'books' then case when p_locale='ja' then '本・文学' else 'Books' end
       when 'travel' then case when p_locale='ja' then '旅行・場所' else 'Travel / Places' end
       when 'tech' then case when p_locale='ja' then 'テクノロジー' else 'Technology' end
       when 'lifestyle' then case when p_locale='ja' then 'ライフ・趣味' else 'Lifestyle / Hobbies' end
       else case when p_locale='ja' then 'その他' else 'Other' end
     end,
     (select pg_catalog.string_agg(e.value->>'name',' ')
      from pg_catalog.jsonb_array_elements(case
        when pg_catalog.jsonb_typeof(p_snapshot->'rows')='array'
          then p_snapshot->'rows' else '[]'::jsonb end) as e(value)),
     (select pg_catalog.string_agg(e.value->>'name',' ')
      from pg_catalog.jsonb_array_elements(case
        when pg_catalog.jsonb_typeof(p_snapshot->'criteria')='array'
          then p_snapshot->'criteria' else '[]'::jsonb end) as e(value))
   ),'NFKC')), '・/\,_-', '      '), '\s+', ' ', 'g'));
$$;
revoke all on function public.discover_search_blob_v1(text,text,jsonb,text) from public;
grant execute on function public.discover_search_blob_v1(text,text,jsonb,text) to anon,authenticated;

-- Search within all keyword sources, Public only. Two indices preserve
-- locale-specific category labels and original JA/EN search semantics.
create index if not exists topics_discover_search_ja_trgm_idx
on public.topics using gin (
  public.discover_search_blob_v1(title,description,snapshot,'ja'::text) extensions.gin_trgm_ops
) where visibility='public';
create index if not exists topics_discover_search_en_trgm_idx
on public.topics using gin (
  public.discover_search_blob_v1(title,description,snapshot,'en'::text) extensions.gin_trgm_ops
) where visibility='public';

-- R42_DISCOVER_SEARCH_CUTOVER.sql
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
    -- The first full normalized term activates the locale's trigram index.
    -- Every remaining term is verified below with literal strpos semantics.
    and (a.needle='' or
      (a.locale='ja' and
        public.discover_search_blob_v1(t.title,t.description,t.snapshot,'ja')
          like '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
          pg_catalog.split_part(a.needle,' ',1),'!','!!'),'%','!%'),'_','!_') || '%' escape '!')
      or (a.locale='en' and
        public.discover_search_blob_v1(t.title,t.description,t.snapshot,'en')
          like '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
          pg_catalog.split_part(a.needle,' ',1),'!','!!'),'%','!%'),'_','!_') || '%' escape '!')
    )
),
filtered as materialized (
  select b.* from public_only b cross join args a
  where (a.category='all' or b.category=a.category)
    and (a.needle='' or not exists (
      select 1 from pg_catalog.unnest(pg_catalog.string_to_array(a.needle,' ')) as term(word)
      where pg_catalog.strpos(
        public.discover_search_blob_v1(b.title,b.description,b.snapshot,a.locale),
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

-- R43_DISCOVER_PUBLIC_HYDRATE.sql
-- R43: only re-hydrate a cached set of Public IDs against current RLS.
-- Never cache topic body/snapshot. This API rechecks visibility every request.
create or replace function public.discover_public_cards_by_ids_v1(
 p_ids uuid[], p_view text default 'all', p_anchor timestamptz default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
with page as (
 select t.*, req.ord
 from pg_catalog.unnest((coalesce(p_ids,'{}'::uuid[]))[1:12])
    with ordinality as req(id,ord)
 join public.topics t on t.id=req.id
 where t.visibility='public'
   and (t.published_at is null or t.published_at<=coalesce(p_anchor,now()))
   and (p_view<>'community' or (t.show_community=true and t.allow_ratings=true))
)
select coalesce(pg_catalog.jsonb_agg(
  pg_catalog.jsonb_build_object(
   'id',p.id,'title',p.title,'description',p.description,
   'language_code',p.language_code,'score_scale',p.score_scale,'weighted',p.weighted,
   'published_at',p.published_at,'snapshot_updated_at',p.snapshot_updated_at,
   'snapshot',p.snapshot,'source_topic_id',p.source_topic_id,
   'show_community',p.show_community,'allow_ratings',p.allow_ratings,
   'visibility',p.visibility,
   'participants',public.discover_public_participant_count_v1(p.id),
   'remixCount',public.discover_public_remix_count_v1(p.id)
  ) order by p.ord
),'[]'::jsonb) from page p;
$$;
revoke all on function public.discover_public_cards_by_ids_v1(uuid[],text,timestamptz) from public;
grant execute on function public.discover_public_cards_by_ids_v1(uuid[],text,timestamptz) to anon,authenticated;

COMMIT;
