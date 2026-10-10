-- R28 Phase 2 / Safe least-privilege cleanup (no row updates or deletes).
-- Supabase project ibpdxbeltdwkquowjeay.
-- Keep all existing SELECT / INSERT / UPDATE / DELETE grants and RLS policies.
-- PostgreSQL TRUNCATE is not subject to RLS: browsers should NEVER have it.
-- CREATE TRIGGER and REFERENCES are schema-management privileges, not app operations.
--
-- Rolling back this privileges-only change: see R28_P2_PRIVILEGE_ROLLBACK.sql.
--
-- Scope/assumptions checked before cutover:
--  * public topics/criteria/topic_items/rating_sets/scores all have RLS
--  * old direct rating RPC closed to anon/authenticated
--  * privileged rating gateway executable only by service_role
--  * service_role's existing table privileges intentionally remain unchanged
--  * function public.set_updated_at() is a simple trigger (NEW.updated_at = now())
--
-- No changes to app data, server secrets, auth, schema columns or trigger routing.

alter function public.set_updated_at()
  set search_path = pg_catalog;

revoke truncate, trigger, references
  on table
    public.topics,
    public.criteria,
    public.topic_items,
    public.rating_sets,
    public.scores
  from anon, authenticated;

-- Atomic guard: abort this migration if key security/compatibility invariants break.
do $r28_guard$
declare
  v_table text;
  v_role text;
begin
  foreach v_table in array array['topics','criteria','topic_items','rating_sets','scores'] loop
    foreach v_role in array array['anon','authenticated'] loop
      if has_table_privilege(v_role,format('public.%I',v_table),'TRUNCATE')
      or has_table_privilege(v_role,format('public.%I',v_table),'TRIGGER')
      or has_table_privilege(v_role,format('public.%I',v_table),'REFERENCES') then
        raise exception 'R28 security guard failed for % %',v_role,v_table;
      end if;
    end loop;
  end loop;
  if has_function_privilege('authenticated',
     'public.save_my_topic_rating(uuid,jsonb,boolean)','EXECUTE')
  or has_function_privilege('anon',
     'public.save_my_topic_rating(uuid,jsonb,boolean)','EXECUTE') then
    raise exception 'R28 failed: direct rating RPC unexpectedly accessible';
  end if;
  if not has_function_privilege('service_role',
      'public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)','EXECUTE')
  or has_function_privilege('authenticated',
      'public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)','EXECUTE') then
    raise exception 'R28 failed: gateway role isolation unexpectedly changed';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid='public.set_updated_at()'::regprocedure
    and proconfig @> array['search_path=pg_catalog']::text[]
  ) then
    raise exception 'R28 failed: trigger timestamp search_path not fixed';
  end if;
end;
$r28_guard$;
