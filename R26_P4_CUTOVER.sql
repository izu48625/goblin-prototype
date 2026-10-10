-- Stats Maker R26 P4 / STEP B (ENFORCEMENT CUTOVER)
-- DO NOT APPLY before all prerequisites are complete:
-- 1. R26_P4_PREPARE_GATEWAY.sql exists in production.
-- 2. Cloudflare Worker TURNSTILE_SITE_KEY and TURNSTILE_SECRET are configured.
-- 3. Cloudflare Worker SUPABASE_SERVICE_ROLE_KEY is set as a SECRET (never in GitHub).
-- 4. TURNSTILE_COMMUNITY_STAGE=1, live submission with a real anonymous
--    identity and real Turnstile challenge is confirmed successful.
-- 5. Rollback file R26_P4_ROLLBACK.sql is ready.
--
-- This change intentionally blocks direct authenticated/anonymous RPC calls
-- without changing saved votes. The Worker uses the service-role-only wrapper.

begin;

do $$
begin
  if to_regprocedure(
    'public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)'
  ) is null then
    raise exception 'Prepare migration missing. Stop before revoking.';
  end if;
  if not has_function_privilege('service_role',
    'public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)','EXECUTE') then
    raise exception 'Service-role gateway RPC not executable.';
  end if;
  if has_function_privilege('authenticated',
    'public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)','EXECUTE') then
    raise exception 'Gateway RPC exposed to public users.';
  end if;
end;
$$;

-- Grant only to the Worker-controlled service-role wrapper.
-- PUBLIC is a database pseudo-role; revoking it is essential.
revoke execute on function public.save_my_topic_rating(uuid,jsonb,boolean)
  from public, anon, authenticated;

do $$
begin
  if has_function_privilege('authenticated',
       'public.save_my_topic_rating(uuid,jsonb,boolean)','EXECUTE')
     or has_function_privilege('anon',
       'public.save_my_topic_rating(uuid,jsonb,boolean)','EXECUTE') then
    raise exception 'Direct Community RPC is still executable from a browser.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;

-- Expected: direct_authenticated=false, direct_anon=false,
-- trusted_gateway=true.
select
 has_function_privilege('authenticated',
  'public.save_my_topic_rating(uuid,jsonb,boolean)','EXECUTE') as direct_authenticated,
 has_function_privilege('anon',
  'public.save_my_topic_rating(uuid,jsonb,boolean)','EXECUTE') as direct_anon,
 has_function_privilege('service_role',
  'public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)','EXECUTE') as trusted_gateway;
