-- R53 search normalization fixture, captured read-only from live DB.
CREATE OR REPLACE FUNCTION public.discover_search_blob_v1(p_title text, p_description text, p_snapshot jsonb, p_locale text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
$function$
;
