-- R41 private counter reads remain guarded by current PUBLIC visibility.
-- Existing public API name/signature and semantics unchanged.
create or replace function public.get_topic_participant_count(p_topic_id uuid)
returns bigint language sql stable security definer set search_path='' as $$
select case when exists(
 select 1 from public.topics t
 where t.id=p_topic_id and t.visibility in ('public','unlisted') and t.show_community=true
) then coalesce((select participants from private.discover_counters where topic_id=p_topic_id),0)
else 0::bigint end
$$;

-- A separate strictly Public-only remix counter used by Discover.
create or replace function public.discover_public_remix_count_v1(p_topic_id uuid)
returns bigint language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.topics t where t.id=p_topic_id and t.visibility='public')
 then coalesce((select remixes from private.discover_counters where topic_id=p_topic_id),0)
 else 0::bigint end
$$;
revoke all on function public.discover_public_remix_count_v1(uuid) from public,anon,authenticated;
grant execute on function public.discover_public_remix_count_v1(uuid) to anon,authenticated;
