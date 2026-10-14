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
