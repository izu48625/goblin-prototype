-- Stats Maker R26 P4 / STEP A (PREPARE ONLY)
-- This migration adds a privileged Community gateway RPC. It intentionally
-- leaves public.save_my_topic_rating callable until the stage and real-device
-- tests have passed. Never run STEP B before the Worker service-role secret is
-- installed, stage=1, and the actual end-to-end save succeeds.
--
-- The Worker verifies the user's JWT with Supabase Auth and validates the
-- single-use Cloudflare Turnstile challenge. The Worker then invokes this
-- service-role-only routine and supplies the Auth API's user.id.
-- p_user_id is NEVER accepted directly from the user's browser.
--
-- Existing ratings and schemas are unchanged. No service key is stored in SQL.

begin;

create or replace function public.gateway_save_my_topic_rating(
  p_user_id uuid,
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
set search_path = ''
as $$
begin
  -- Must be the verified Supabase service_role JWT, never a user JWT.
  -- This check must occur BEFORE temporarily setting the end-user identity.
  if auth.role() is distinct from 'service_role' then
    raise exception 'Privileged gateway required.' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'Missing authenticated user.' using errcode = '22023';
  end if;

  -- The nested, already-tested save_my_topic_rating performs all validation
  -- and consumes the same 60/hour per-identity budget as before. Its auth.uid()
  -- resolves the authenticated user ID verified by the trusted Worker.
  -- set_config(..., true) is limited to this PostgREST transaction.
  perform pg_catalog.set_config('request.jwt.claim.sub',p_user_id::text,true);
  -- Fail closed if a future auth.uid() implementation stops honoring this
  -- transaction-local claim. Never risk attributing a vote to another actor.
  if auth.uid() is distinct from p_user_id then
    raise exception 'Gateway identity forwarding failed.' using errcode = '42501';
  end if;

  return query
  select s.rating_set_id,s.rating_status,s.submitted_at
    from public.save_my_topic_rating(p_topic_id,p_scores,p_submit) s;
end;
$$;

-- New PostgreSQL functions can inherit PUBLIC EXECUTE; revoke explicitly.
revoke all on function public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)
  to service_role;

do $$
begin
  if has_function_privilege('authenticated',
       'public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)','EXECUTE')
     or has_function_privilege('anon',
       'public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)','EXECUTE') then
    raise exception 'Gateway RPC permissions are not properly restricted.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;

-- Expected immediately after preparation:
-- gateway_service=true, gateway_authenticated=false,
-- gateway_anon=false, old_rpc_authenticated=true.
select
  has_function_privilege('service_role',
    'public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)','EXECUTE') as gateway_service,
  has_function_privilege('authenticated',
    'public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)','EXECUTE') as gateway_authenticated,
  has_function_privilege('anon',
    'public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)','EXECUTE') as gateway_anon,
  has_function_privilege('authenticated',
    'public.save_my_topic_rating(uuid,jsonb,boolean)','EXECUTE') as old_rpc_authenticated;
