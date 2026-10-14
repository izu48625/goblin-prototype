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
