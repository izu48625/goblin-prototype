-- Stats Maker R18 C4 Guest Publish migration
-- Run once in Supabase SQL Editor after enabling Authentication > Anonymous Sign-Ins.

begin;

alter table public.topics enable row level security;
alter table public.topic_items enable row level security;
alter table public.criteria enable row level security;

drop policy if exists "guest_creator_select_own_topics" on public.topics;
create policy "guest_creator_select_own_topics" on public.topics for select to authenticated using (owner_id = auth.uid());

drop policy if exists "guest_creator_insert_own_topics" on public.topics;
create policy "guest_creator_insert_own_topics" on public.topics for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "guest_creator_update_own_topics" on public.topics;
create policy "guest_creator_update_own_topics" on public.topics for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "guest_creator_select_own_items" on public.topic_items;
create policy "guest_creator_select_own_items" on public.topic_items for select to authenticated using (exists (select 1 from public.topics t where t.id = topic_items.topic_id and t.owner_id = auth.uid()));

drop policy if exists "guest_creator_insert_own_items" on public.topic_items;
create policy "guest_creator_insert_own_items" on public.topic_items for insert to authenticated with check (exists (select 1 from public.topics t where t.id = topic_items.topic_id and t.owner_id = auth.uid()));

drop policy if exists "guest_creator_delete_own_items" on public.topic_items;
create policy "guest_creator_delete_own_items" on public.topic_items for delete to authenticated using (exists (select 1 from public.topics t where t.id = topic_items.topic_id and t.owner_id = auth.uid()));

drop policy if exists "guest_creator_select_own_criteria" on public.criteria;
create policy "guest_creator_select_own_criteria" on public.criteria for select to authenticated using (exists (select 1 from public.topics t where t.id = criteria.topic_id and t.owner_id = auth.uid()));

drop policy if exists "guest_creator_insert_own_criteria" on public.criteria;
create policy "guest_creator_insert_own_criteria" on public.criteria for insert to authenticated with check (exists (select 1 from public.topics t where t.id = criteria.topic_id and t.owner_id = auth.uid()));

drop policy if exists "guest_creator_delete_own_criteria" on public.criteria;
create policy "guest_creator_delete_own_criteria" on public.criteria for delete to authenticated using (exists (select 1 from public.topics t where t.id = criteria.topic_id and t.owner_id = auth.uid()));

commit;
notify pgrst, 'reload schema';
