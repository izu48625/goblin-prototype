-- R41: counters are maintained transactionally in a non-exposed schema.
-- No API grants on private data, and no change to existing write permissions.
create schema if not exists private;
create table if not exists private.discover_counters (
  topic_id uuid primary key references public.topics(id) on delete cascade,
  participants bigint not null default 0 check (participants >= 0),
  remixes bigint not null default 0 check (remixes >= 0)
);
revoke all on private.discover_counters from public, anon, authenticated;
alter table private.discover_counters enable row level security;

create or replace function private.refresh_discover_counter(p_topic_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_topic_id is null then return; end if;
  -- Serialize on the parent row, rather than taking opaque advisory locks
  -- that can create avoidable cross-topic deadlock cycles.
  -- This also coordinates with concurrent topic updates and deletes.
  perform 1 from public.topics where id=p_topic_id for update;
  if not found then return; end if;
  if not exists(select 1 from public.topics where id=p_topic_id) then
    delete from private.discover_counters where topic_id=p_topic_id;
    return;
  end if;
  insert into private.discover_counters(topic_id,participants,remixes)
  select t.id,
    case when t.show_community then
      (select count(*) from public.rating_sets rs where rs.topic_id=t.id and rs.status='submitted')
      else 0::bigint end,
    (select count(*) from public.topics child where child.source_topic_id=t.id
      and child.visibility='public'
      and pg_catalog.lower(coalesce(child.snapshot#>>'{lineage,relation}',''))='remix')
  from public.topics t where t.id=p_topic_id
  on conflict(topic_id) do update
    set participants=excluded.participants, remixes=excluded.remixes;
end; $$;
revoke all on function private.refresh_discover_counter(uuid) from public,anon,authenticated;

create or replace function private.discover_rating_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    perform private.refresh_discover_counter(old.topic_id);
    return old;
  end if;
  perform private.refresh_discover_counter(new.topic_id);
  if tg_op='UPDATE' and old.topic_id is distinct from new.topic_id then
    perform private.refresh_discover_counter(old.topic_id);
  end if;
  return new;
end; $$;
revoke all on function private.discover_rating_changed() from public,anon,authenticated;

create or replace function private.discover_topic_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    perform private.refresh_discover_counter(old.source_topic_id);
    return old;
  end if;
  perform private.refresh_discover_counter(new.id);
  perform private.refresh_discover_counter(new.source_topic_id);
  if tg_op='UPDATE' and old.source_topic_id is distinct from new.source_topic_id then
    perform private.refresh_discover_counter(old.source_topic_id);
  end if;
  return new;
end; $$;
revoke all on function private.discover_topic_changed() from public,anon,authenticated;

drop trigger if exists r41_discover_rating_counter on public.rating_sets;
create trigger r41_discover_rating_counter
after insert or update of status,topic_id or delete on public.rating_sets
for each row execute function private.discover_rating_changed();

drop trigger if exists r41_discover_topic_counter on public.topics;
create trigger r41_discover_topic_counter
after insert or update of visibility,source_topic_id,snapshot,show_community,allow_ratings or delete on public.topics
for each row execute function private.discover_topic_changed();

-- Initial backfill is additive and does not touch existing publications or ratings.
insert into private.discover_counters(topic_id,participants,remixes)
select t.id,
 case when t.show_community then
   (select count(*) from public.rating_sets rs where rs.topic_id=t.id and rs.status='submitted')
   else 0::bigint end,
 (select count(*) from public.topics child where child.source_topic_id=t.id and child.visibility='public'
    and pg_catalog.lower(coalesce(child.snapshot#>>'{lineage,relation}',''))='remix')
from public.topics t
on conflict(topic_id) do update set
 participants=excluded.participants,remixes=excluded.remixes;

-- Only expose Public works, preserving R40's privacy, search and stable ordering.
-- R40 remains installed for immediate rollback.
