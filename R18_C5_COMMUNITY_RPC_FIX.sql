-- Stats Maker R18 C5 Community RPC hotfix
-- Fixes: "column reference \"rating_set_id\" is ambiguous"
-- Run once in Supabase SQL Editor.

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
  returning public.rating_sets.id,
            public.rating_sets.status,
            public.rating_sets.submitted_at
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
    update public.rating_sets rs
      set status='submitted'
    where rs.id = v_rating_set_id
    returning rs.status,rs.submitted_at
      into v_status,v_submitted_at;
  elsif v_status='submitted' then
    update public.rating_sets rs
      set updated_at=now()
    where rs.id = v_rating_set_id;
  end if;

  return query
  select v_rating_set_id,v_status,v_submitted_at;
end;
$$;

revoke all on function public.save_my_topic_rating(uuid,jsonb,boolean) from public;
grant execute on function public.save_my_topic_rating(uuid,jsonb,boolean) to authenticated;

notify pgrst, 'reload schema';
