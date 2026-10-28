-- R117 free-tier guard: each topic has at most 40 fixed-name, 50 KiB JPEGs.
-- Reject arbitrary versioned paths that could otherwise consume unbounded Storage.
drop policy if exists "r117_topic_target_images_insert_owner" on storage.objects;
create policy "r117_topic_target_images_insert_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id='topic-target-images'
  and name ~ '^[0-9a-f-]{36}/([0-9]|[1-3][0-9])[.]jpg$'
  and exists (
    select 1 from public.topics t
    where t.id::text=split_part(storage.objects.name,'/',1)
      and t.owner_id=(select auth.uid())
  )
);

drop policy if exists "r117_topic_target_images_update_owner" on storage.objects;
create policy "r117_topic_target_images_update_owner"
on storage.objects for update to authenticated
using (
  bucket_id='topic-target-images'
  and exists (
    select 1 from public.topics t
    where t.id::text=split_part(storage.objects.name,'/',1)
      and t.owner_id=(select auth.uid())
  )
)
with check (
  bucket_id='topic-target-images'
  and name ~ '^[0-9a-f-]{36}/([0-9]|[1-3][0-9])[.]jpg$'
  and exists (
    select 1 from public.topics t
    where t.id::text=split_part(storage.objects.name,'/',1)
      and t.owner_id=(select auth.uid())
  )
);
