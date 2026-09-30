-- ============================================================
-- Stats Maker R18 Integrated Candidate
-- Incremental migration for an existing Stats Maker DB-R2 project.
-- Run ONCE in Supabase SQL Editor.
-- ============================================================

begin;

alter table public.topics
  add column if not exists snapshot_version smallint not null default 1
    check (snapshot_version >= 1);

alter table public.topics
  add column if not exists snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(snapshot) = 'object');

alter table public.topics
  add column if not exists snapshot_updated_at timestamptz;

comment on column public.topics.snapshot is
  'Read-only creator snapshot for Stats Maker public pages and Remix.';

-- Atomic save/update for one participant's rating matrix.
-- Supabase Anonymous Auth also uses the authenticated role.
create or replace function public.save_my_topic_rating(
  p_topic_id uuid,
  p_scores jsonb,
  p_submit boolean default false
)
returns table (
  rating_set_id uuid,
  rating_status text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_rating_set_id uuid;
  v_status text;
  v_submitted_at timestamptz;
  v_bad_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.topic_accepts_my_ratings(p_topic_id) then
    raise exception 'This topic does not accept ratings.';
  end if;

  if p_scores is null or jsonb_typeof(p_scores) <> 'array' then
    raise exception 'p_scores must be a JSON array.';
  end if;

  -- Validate every referenced item and criterion before touching existing data.
  select count(*)::integer
    into v_bad_count
  from jsonb_to_recordset(p_scores) as x(item_id uuid, criterion_id uuid, score numeric)
  left join public.topic_items i
    on i.id = x.item_id and i.topic_id = p_topic_id
  left join public.criteria c
    on c.id = x.criterion_id and c.topic_id = p_topic_id
  where i.id is null or c.id is null or x.score is null;

  if v_bad_count > 0 then
    raise exception 'Rating payload references invalid items or criteria.';
  end if;

  insert into public.rating_sets(topic_id,user_id,status)
  values (p_topic_id,v_user_id,'draft')
  on conflict (topic_id,user_id)
  do update set updated_at=now()
  returning id,status,public.rating_sets.submitted_at
    into v_rating_set_id,v_status,v_submitted_at;

  delete from public.scores s
  where s.rating_set_id = v_rating_set_id;

  insert into public.scores(topic_id,rating_set_id,item_id,criterion_id,score)
  select
    p_topic_id,
    v_rating_set_id,
    x.item_id,
    x.criterion_id,
    x.score
  from jsonb_to_recordset(p_scores) as x(item_id uuid, criterion_id uuid, score numeric);

  if p_submit and v_status = 'draft' then
    update public.rating_sets
      set status='submitted'
    where id=v_rating_set_id
    returning status,public.rating_sets.submitted_at
      into v_status,v_submitted_at;
  elsif v_status='submitted' then
    update public.rating_sets set updated_at=now() where id=v_rating_set_id;
  end if;

  return query select v_rating_set_id,v_status,v_submitted_at;
end;
$$;

revoke all on function public.save_my_topic_rating(uuid,jsonb,boolean) from public;
grant execute on function public.save_my_topic_rating(uuid,jsonb,boolean) to authenticated;

-- ============================================================
-- R18 guest creator policies
-- Anonymous Supabase users use the authenticated role.
-- These policies let an anonymous creator publish/update only rows they own.
-- ============================================================

alter table public.topics enable row level security;
alter table public.topic_items enable row level security;
alter table public.criteria enable row level security;

drop policy if exists "guest_creator_select_own_topics" on public.topics;
create policy "guest_creator_select_own_topics"
on public.topics for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "guest_creator_insert_own_topics" on public.topics;
create policy "guest_creator_insert_own_topics"
on public.topics for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "guest_creator_update_own_topics" on public.topics;
create policy "guest_creator_update_own_topics"
on public.topics for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "guest_creator_select_own_items" on public.topic_items;
create policy "guest_creator_select_own_items"
on public.topic_items for select
to authenticated
using (exists (
  select 1 from public.topics t
  where t.id = topic_items.topic_id and t.owner_id = auth.uid()
));

drop policy if exists "guest_creator_insert_own_items" on public.topic_items;
create policy "guest_creator_insert_own_items"
on public.topic_items for insert
to authenticated
with check (exists (
  select 1 from public.topics t
  where t.id = topic_items.topic_id and t.owner_id = auth.uid()
));

drop policy if exists "guest_creator_delete_own_items" on public.topic_items;
create policy "guest_creator_delete_own_items"
on public.topic_items for delete
to authenticated
using (exists (
  select 1 from public.topics t
  where t.id = topic_items.topic_id and t.owner_id = auth.uid()
));

drop policy if exists "guest_creator_select_own_criteria" on public.criteria;
create policy "guest_creator_select_own_criteria"
on public.criteria for select
to authenticated
using (exists (
  select 1 from public.topics t
  where t.id = criteria.topic_id and t.owner_id = auth.uid()
));

drop policy if exists "guest_creator_insert_own_criteria" on public.criteria;
create policy "guest_creator_insert_own_criteria"
on public.criteria for insert
to authenticated
with check (exists (
  select 1 from public.topics t
  where t.id = criteria.topic_id and t.owner_id = auth.uid()
));

drop policy if exists "guest_creator_delete_own_criteria" on public.criteria;
create policy "guest_creator_delete_own_criteria"
on public.criteria for delete
to authenticated
using (exists (
  select 1 from public.topics t
  where t.id = criteria.topic_id and t.owner_id = auth.uid()
));

commit;

notify pgrst, 'reload schema';
