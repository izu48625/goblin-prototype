-- R41 rollback order: first restore original participant count RPC.
create or replace function public.get_topic_participant_count(p_topic_id uuid)
returns bigint language sql stable security definer set search_path='public' as $$
 select count(*)::bigint
 from public.rating_sets rs
 where rs.topic_id=p_topic_id and rs.status='submitted'
 and exists(select 1 from public.topics t where t.id=p_topic_id
 and t.show_community=true and t.visibility in ('public','unlisted'));
$$;
drop function if exists public.discover_public_remix_count_v1(uuid);
drop trigger if exists r41_discover_rating_counter on public.rating_sets;
drop trigger if exists r41_discover_topic_counter on public.topics;
drop function if exists private.discover_rating_changed();
drop function if exists private.discover_topic_changed();
drop function if exists private.refresh_discover_counter(uuid);
drop table if exists private.discover_counters;
drop index if exists public.topics_discover_public_category_idx;
-- Do not drop the preexisting private schema or any user data.
