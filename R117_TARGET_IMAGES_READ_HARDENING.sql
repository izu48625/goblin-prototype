-- R117 security tightening: do not allow bucket enumeration of URL-only work images.
-- Only the current published target image may be signed; owners retain normal Storage maintenance access.
drop policy if exists "r117_topic_target_images_read" on storage.objects;
create policy "r117_topic_target_images_read"
on storage.objects for select to anon, authenticated
using (
  bucket_id='topic-target-images'
  and (
    exists (
      select 1 from public.topics t
      where t.id::text=split_part(storage.objects.name,'/',1)
        and t.owner_id=(select auth.uid())
    )
    or (
      storage.allow_any_operation(array['object.sign','object.sign_many','object.get_authenticated'])
      and exists (
        select 1 from public.topic_items i
        join public.topics t on t.id=i.topic_id
        where i.image_url=storage.objects.name
          and t.id::text=split_part(storage.objects.name,'/',1)
          and t.visibility in ('public','unlisted')
      )
    )
  )
);
