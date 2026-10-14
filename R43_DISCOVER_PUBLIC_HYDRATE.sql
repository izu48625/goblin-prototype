-- R43: only re-hydrate a cached set of Public IDs against current RLS.
-- Never cache topic body/snapshot. This API rechecks visibility every request.
create or replace function public.discover_public_cards_by_ids_v1(
 p_ids uuid[], p_view text default 'all', p_anchor timestamptz default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
with page as (
 select t.*, req.ord
 from pg_catalog.unnest(coalesce(p_ids,'{}'::uuid[])[1:12])
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
