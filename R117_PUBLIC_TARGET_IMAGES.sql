-- R117 public target thumbnails: authoritative reference after the three migrations
-- r117_private_public_target_images, r117_target_images_read_hardening,
-- and r117_target_images_fixed_paths (already applied to the connected project).
-- This file documents the FINAL policy state. Do not reapply it blindly.
--
-- Each creator owns at most 40 fixed-position JPEG files per topic (0.jpg ... 39.jpg).
-- The bucket is PRIVATE even when a topic is Public or Unlisted.
-- Read access grants signing ONLY for paths linked to viewable topic_items;
-- Private topic images can be signed by their owner, not by other visitors.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('topic-target-images','topic-target-images',false,51200,array['image/jpeg']::text[])
on conflict (id) do update
set public=false,file_size_limit=51200,allowed_mime_types=array['image/jpeg']::text[];

-- Reference policy declarations; already applied in Supabase migrations.
-- The operation-aware SELECT prevents anonymous bucket listing and signing
-- of files no longer linked to a Public or Unlisted topic.
drop policy if exists "r117_topic_target_images_read" on storage.objects;
create policy "r117_topic_target_images_read"
on storage.objects for select to anon, authenticated
using (
  bucket_id='topic-target-images'
  and (
    exists (select 1 from public.topics t
      where t.id::text=split_part(name,'/',1)
        and t.owner_id=(select auth.uid()))
    or (
      storage.allow_any_operation(array['object.sign','object.sign_many','object.get_authenticated'])
      and exists (select 1 from public.topic_items i
        join public.topics t on t.id=i.topic_id
        where i.image_url=storage.objects.name
          and t.id::text=split_part(storage.objects.name,'/',1)
          and t.visibility in ('public','unlisted'))
    )
  )
);

drop policy if exists "r117_topic_target_images_insert_owner" on storage.objects;
create policy "r117_topic_target_images_insert_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id='topic-target-images'
  and name ~ '^[0-9a-f-]{36}/([0-9]|[1-3][0-9])[.]jpg$'
  and exists (select 1 from public.topics t
    where t.id::text=split_part(name,'/',1)
      and t.owner_id=(select auth.uid()))
);

drop policy if exists "r117_topic_target_images_update_owner" on storage.objects;
create policy "r117_topic_target_images_update_owner"
on storage.objects for update to authenticated
using (
  bucket_id='topic-target-images'
  and exists (select 1 from public.topics t
    where t.id::text=split_part(name,'/',1)
      and t.owner_id=(select auth.uid()))
)
with check (
  bucket_id='topic-target-images'
  and name ~ '^[0-9a-f-]{36}/([0-9]|[1-3][0-9])[.]jpg$'
  and exists (select 1 from public.topics t
    where t.id::text=split_part(name,'/',1)
      and t.owner_id=(select auth.uid()))
);

drop policy if exists "r117_topic_target_images_delete_owner" on storage.objects;
create policy "r117_topic_target_images_delete_owner"
on storage.objects for delete to authenticated
using (
  bucket_id='topic-target-images'
  and exists (select 1 from public.topics t
    where t.id::text=split_part(name,'/',1)
      and t.owner_id=(select auth.uid()))
);
