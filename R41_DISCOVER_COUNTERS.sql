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
