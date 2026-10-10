-- Stats Maker R26 P2: transactional DB protection for anonymous-first writes.
-- Applied through a database migration; no charges, no service role in the browser.
-- One user per topic vote remains unchanged; existing rows untouched.
-- The Supabase migration runner supplies transaction management.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.write_budgets (
  actor_id uuid not null,
  action_name text not null,
  window_start timestamptz not null default now(),
  hits integer not null default 0,
  primary key (actor_id, action_name)
);
revoke all on private.write_budgets from public, anon, authenticated;
alter table private.write_budgets enable row level security;

-- Bound and serialize write attempts per Supabase identity; avoid public RPC
-- exposure by keeping this routine in the non-exposed private schema.
create or replace function private.consume_write_budget(
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_hits integer;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid quota configuration.';
  end if;

  insert into private.write_budgets(actor_id,action_name,window_start,hits)
  values (v_actor,p_action,v_now,1)
  on conflict (actor_id,action_name)
  do update set
    window_start=case
      when private.write_budgets.window_start <= v_now - make_interval(secs=>p_window_seconds)
        then v_now
      else private.write_budgets.window_start
    end,
    hits=case
      when private.write_budgets.window_start <= v_now - make_interval(secs=>p_window_seconds)
        then 1
      else private.write_budgets.hits + 1
    end
  where private.write_budgets.window_start <= v_now - make_interval(secs=>p_window_seconds)
    or private.write_budgets.hits < p_limit
  returning hits into v_hits;

  if v_hits is null then
    raise exception 'RATE_LIMITED: too many writes; please try later.';
  end if;
end;
$$;

revoke all on function private.consume_write_budget(text,integer,integer)
  from public, anon, authenticated;

create or replace function private.enforce_topic_write_budget()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Allow trusted SQL/migration administration and service-role maintenance;
  -- browser traffic always carries an anon/authenticated JWT role.
  if auth.uid() is null and auth.role() is null then
    return new;
  end if;
  if auth.role() = 'service_role' then
    return new;
  end if;
  if auth.uid() is null or new.owner_id is distinct from auth.uid() then
    raise exception 'Topic owner must match authenticated user.';
  end if;

  if length(new.title) > 180
     or length(new.description) > 3000
     or octet_length(new.snapshot::text) > 220000 then
    raise exception 'Topic content exceeds publication limits.';
  end if;

  if tg_op = 'INSERT' then
    perform private.consume_write_budget('topic_create',30,86400);
  else
    perform private.consume_write_budget('topic_update',120,3600);
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_topic_write_budget()
  from public, anon, authenticated;

drop trigger if exists r26_topic_write_budget on public.topics;
create trigger r26_topic_write_budget
  before insert or update on public.topics
  for each row execute function private.enforce_topic_write_budget();

-- Keep exact existing R20 behavior, with a bounded payload and transactional
-- per-identity write quota. SECURITY DEFINER continues to own the writes.
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

  if jsonb_array_length(p_scores) > 400 then
    raise exception 'Rating payload exceeds 400 scores.';
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

  -- Transactional quota across all topics for this anonymous user.
  perform private.consume_write_budget('rating',60,3600);

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

-- Only the validated SECURITY DEFINER RPC may mutate votes. Clients can
-- still select their own rows for draft restoration.
revoke insert, update, delete on public.rating_sets from anon, authenticated;
revoke insert, update, delete on public.scores from anon, authenticated;

notify pgrst, 'reload schema';
