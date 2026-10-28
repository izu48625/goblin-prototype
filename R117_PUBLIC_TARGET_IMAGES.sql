-- R117: small creator-owned target thumbnails for public work pages.
-- Private bucket: public/unlisted topic images are signed per view; private works remain owner-only.
-- 50 KiB JPEG cap and one named object per target image version protect Free quotas.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('topic-target-images','topic-target-images',false,51200,array['image/jpeg']::text[])
on conflict (id) do update
set public=false,file_size_limit=51200,allowed_mime_types=array['image/jpeg']::text[];

create policy "r117_topic_target_images_read"
on storage.objects for select to anon, authenticated
using (
  bucket_id='topic-target-images'
  and exists (
    select 1 from public.topics t
    where t.id::text=split_part(name,'/',1)
      and (t.visibility in ('public','unlisted') or t.owner_id=(select auth.uid()))
  )
);

create policy "r117_topic_target_images_insert_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id='topic-target-images'
  and name ~ '^[0-9a-f-]{36}/([0-9]|[1-3][0-9])-[0-9a-f]{12}[.]jpg$'
  and exists (select 1 from public.topics t
    where t.id::text=split_part(name,'/',1)
      and t.owner_id=(select auth.uid()))
);

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
  and name ~ '^[0-9a-f-]{36}/([0-9]|[1-3][0-9])-[0-9a-f]{12}[.]jpg$'
  and exists (select 1 from public.topics t
    where t.id::text=split_part(name,'/',1)
      and t.owner_id=(select auth.uid()))
);

create policy "r117_topic_target_images_delete_owner"
on storage.objects for delete to authenticated
using (
  bucket_id='topic-target-images'
  and exists (select 1 from public.topics t
    where t.id::text=split_part(name,'/',1)
      and t.owner_id=(select auth.uid()))
);
