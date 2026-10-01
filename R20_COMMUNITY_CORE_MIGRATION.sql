-- Stats Maker R20 Community Core
-- Run once in Supabase SQL Editor.
-- Purpose:
-- 1) enforce one Community rating set per user/topic,
-- 2) validate Community submissions server-side,
-- 3) expose privacy-safe Community aggregates (minimum 5 responses per item/cell).

begin;

-- One authenticated/anonymous Supabase user can have only one rating set per topic.
create unique index if not exists rating_sets_topic_user_unique
  on public.rating_sets(topic_id,user_id);

-- Atomic save/update for the current user's Community rating.
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
  v_duplicate_count integer;
  v_complete_items integer;
  v_scale numeric;
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

  select score_scale::numeric
    into v_scale
  from public.topics
  where id = p_topic_id;

  if v_scale is null then
    raise exception 'Topic not found.';
  end if;

  -- Reject invalid references, null scores, and out-of-range values.
  select count(*)::integer
    into v_bad_count
  from jsonb_to_recordset(p_scores) as x(item_id uuid, criterion_id uuid, score numeric)
  left join public.topic_items i
    on i.id = x.item_id and i.topic_id = p_topic_id
  left join public.criteria c
    on c.id = x.criterion_id and c.topic_id = p_topic_id
  where i.id is null
     or c.id is null
     or x.score is null
     or x.score < 0
     or x.score > v_scale;

  if v_bad_count > 0 then
    raise exception 'Rating payload contains invalid items, criteria, or scores.';
  end if;

  -- Reject duplicated item/criterion pairs inside one request.
  select count(*)::integer
    into v_duplicate_count
  from (
    select x.item_id,x.criterion_id
    from jsonb_to_recordset(p_scores) as x(item_id uuid, criterion_id uuid, score numeric)
    group by x.item_id,x.criterion_id
    having count(*) > 1
  ) d;

  if v_duplicate_count > 0 then
    raise exception 'Rating payload contains duplicate item/criterion pairs.';
  end if;

  -- A submitted rating must fully score every criterion for at least one target.
  if p_submit then
    select count(*)::integer
      into v_complete_items
    from public.topic_items i
    where i.topic_id = p_topic_id
      and not exists (
        select 1
        from public.criteria c
        where c.topic_id = p_topic_id
          and not exists (
            select 1
            from jsonb_to_recordset(p_scores) as x(item_id uuid, criterion_id uuid, score numeric)
            where x.item_id = i.id
              and x.criterion_id = c.id
          )
      );

    if coalesce(v_complete_items,0) < 1 then
      raise exception 'Complete every criterion for at least one target before submitting.';
    end if;
  end if;

  insert into public.rating_sets(topic_id,user_id,status)
  values (p_topic_id,v_user_id,'draft')
  on conflict (topic_id,user_id)
  do update set updated_at = now()
  returning public.rating_sets.id,
            public.rating_sets.status,
            public.rating_sets.submitted_at
    into v_rating_set_id,v_status,v_submitted_at;

  delete from public.scores s
  where s.rating_set_id = v_rating_set_id;

  insert into public.scores(topic_id,rating_set_id,item_id,criterion_id,score)
  select p_topic_id,v_rating_set_id,x.item_id,x.criterion_id,x.score
  from jsonb_to_recordset(p_scores) as x(item_id uuid, criterion_id uuid, score numeric);

  if p_submit then
    update public.rating_sets rs
      set status='submitted',
          submitted_at=coalesce(rs.submitted_at,now()),
          updated_at=now()
    where rs.id = v_rating_set_id
    returning rs.status,rs.submitted_at
      into v_status,v_submitted_at;
  elsif v_status='submitted' then
    -- Once submitted, saving again updates the same Community vote rather than
    -- creating a second participant or reverting it to draft.
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

-- Recreate Community aggregate RPCs with an explicit privacy threshold.
drop function if exists public.get_topic_participant_count(uuid);
create function public.get_topic_participant_count(p_topic_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.rating_sets rs
  where rs.topic_id = p_topic_id
    and rs.status = 'submitted'
    and exists (
      select 1 from public.topics t
      where t.id = p_topic_id
        and t.show_community = true
        and t.visibility in ('public','unlisted')
    );
$$;

drop function if exists public.get_community_item_summary(uuid);
create function public.get_community_item_summary(p_topic_id uuid)
returns table (
  item_id uuid,
  response_count bigint,
  avg_overall numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with topic_config as (
    select t.weighted
    from public.topics t
    where t.id = p_topic_id
      and t.show_community = true
      and t.visibility in ('public','unlisted')
  ),
  criterion_count as (
    select count(*)::bigint as n
    from public.criteria c
    where c.topic_id = p_topic_id
  ),
  participant_item as (
    select
      rs.id as rating_set_id,
      s.item_id,
      case
        when (select weighted from topic_config limit 1) then
          sum(s.score * greatest(coalesce(c.weight,1),0))
          / nullif(sum(greatest(coalesce(c.weight,1),0)),0)
        else avg(s.score)
      end as overall
    from public.rating_sets rs
    join public.scores s
      on s.rating_set_id = rs.id and s.topic_id = p_topic_id
    join public.criteria c
      on c.id = s.criterion_id and c.topic_id = p_topic_id
    where rs.topic_id = p_topic_id
      and rs.status = 'submitted'
      and exists (select 1 from topic_config)
    group by rs.id,s.item_id
    having count(distinct s.criterion_id) = (select n from criterion_count)
  ),
  aggregated as (
    select
      pi.item_id,
      count(*)::bigint as response_count,
      avg(pi.overall)::numeric as raw_average
    from participant_item pi
    where pi.overall is not null
    group by pi.item_id
  )
  select
    a.item_id,
    a.response_count,
    case when a.response_count >= 5
      then round(a.raw_average,2)
      else null::numeric
    end as avg_overall
  from aggregated a;
$$;

drop function if exists public.get_community_criterion_summary(uuid);
create function public.get_community_criterion_summary(p_topic_id uuid)
returns table (
  item_id uuid,
  criterion_id uuid,
  response_count bigint,
  avg_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with aggregated as (
    select
      s.item_id,
      s.criterion_id,
      count(distinct rs.id)::bigint as response_count,
      avg(s.score)::numeric as raw_average
    from public.rating_sets rs
    join public.scores s
      on s.rating_set_id = rs.id and s.topic_id = p_topic_id
    where rs.topic_id = p_topic_id
      and rs.status = 'submitted'
      and exists (
        select 1 from public.topics t
        where t.id = p_topic_id
          and t.show_community = true
          and t.visibility in ('public','unlisted')
      )
    group by s.item_id,s.criterion_id
  )
  select
    a.item_id,
    a.criterion_id,
    a.response_count,
    case when a.response_count >= 5
      then round(a.raw_average,2)
      else null::numeric
    end as avg_score
  from aggregated a;
$$;

revoke all on function public.get_topic_participant_count(uuid) from public;
revoke all on function public.get_community_item_summary(uuid) from public;
revoke all on function public.get_community_criterion_summary(uuid) from public;

grant execute on function public.get_topic_participant_count(uuid) to anon,authenticated;
grant execute on function public.get_community_item_summary(uuid) to anon,authenticated;
grant execute on function public.get_community_criterion_summary(uuid) to anon,authenticated;

commit;

notify pgrst, 'reload schema';
