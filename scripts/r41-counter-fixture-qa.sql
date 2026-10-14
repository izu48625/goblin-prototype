-- Executed ONLY on disposable GitHub Actions PostgreSQL service.
-- Actual R41 SQL is imported; no production data.
create role anon;
create role authenticated;
create table public.topics (
 id uuid primary key,
 visibility text not null default 'private',
 snapshot jsonb not null default '{}'::jsonb,
 source_topic_id uuid references public.topics(id) on delete set null,
 show_community boolean not null default true,
 allow_ratings boolean not null default true
);
create table public.rating_sets (
 id uuid primary key,
 topic_id uuid not null references public.topics(id) on delete cascade,
 status text not null default 'draft'
);
alter table public.topics enable row level security;
create policy discover_public_only on public.topics for select to anon using (visibility='public');
grant select on public.topics to anon;
\ir ../R41_DISCOVER_COUNTERS.sql
\ir ../R41_DISCOVER_COUNTER_READERS.sql

insert into public.topics(id,visibility)
values('00000000-0000-4000-8000-000000000101','public');
insert into public.topics(id,visibility,source_topic_id,snapshot)
values('00000000-0000-4000-8000-000000000102','public',
 '00000000-0000-4000-8000-000000000101','{"lineage":{"relation":"remix"}}');
do $$begin
 if (select remixes from private.discover_counters where topic_id='00000000-0000-4000-8000-000000000101')<>1
 then raise exception 'remix publication count incorrect';end if;end$$;
insert into public.rating_sets(id,topic_id,status)
values('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101','draft');
update public.rating_sets set status='submitted' where id='00000000-0000-4000-8000-000000000201';
do $$begin if (select participants from private.discover_counters where topic_id='00000000-0000-4000-8000-000000000101')<>1
 then raise exception 'rating submit count incorrect';end if;end$$;
update public.rating_sets set status='submitted' where id='00000000-0000-4000-8000-000000000201';
update public.topics set visibility='private' where id='00000000-0000-4000-8000-000000000102';
do $$begin if (select remixes from private.discover_counters where topic_id='00000000-0000-4000-8000-000000000101')<>0
 then raise exception 'private remix still counted';end if;end$$;
set role anon;
do $$begin
 if public.discover_public_participant_count_v1('00000000-0000-4000-8000-000000000101')<>1
 then raise exception 'Public rating count not readable';end if;
 if public.discover_public_participant_count_v1('00000000-0000-4000-8000-000000000102')<>0
 then raise exception 'Private rating exposed';end if;
 if has_schema_privilege('anon','private','USAGE') then raise exception 'private schema exposed';end if;
end$$;
reset role;
update public.topics set visibility='public' where id='00000000-0000-4000-8000-000000000102';
update public.topics set snapshot='{"lineage":{"relation":"version"}}'::jsonb where id='00000000-0000-4000-8000-000000000102';
do $$begin if (select remixes from private.discover_counters where topic_id='00000000-0000-4000-8000-000000000101')<>0
 then raise exception 'version erroneously counted as remix';end if;end$$;
delete from public.topics where id='00000000-0000-4000-8000-000000000102';
delete from public.rating_sets where id='00000000-0000-4000-8000-000000000201';
do $$begin
 if (select participants+remixes from private.discover_counters where topic_id='00000000-0000-4000-8000-000000000101')<>0
 then raise exception 'deleted ratings/remixes retained';end if;
end$$;

-- Keep parent for separate concurrent INSERT test.
select 'R41 isolated schema lifecycle QA PASS' as result;
