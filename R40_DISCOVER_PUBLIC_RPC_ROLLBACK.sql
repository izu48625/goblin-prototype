-- R40 rollback: no user data affected.
revoke all on function public.discover_public_works_v1(text,text,text,text,text,integer,integer,timestamptz) from anon,authenticated,public;
drop function if exists public.discover_public_works_v1(text,text,text,text,text,integer,integer,timestamptz);
drop index if exists public.topics_discover_public_newest_idx;
drop index if exists public.topics_discover_public_remix_idx;
