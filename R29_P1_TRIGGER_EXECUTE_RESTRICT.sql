-- R29 P1: restrict direct RPC EXECUTE on internal DML trigger functions.
-- All five functions return trigger, are SECURITY DEFINER, and already have
-- their original trigger bindings on public tables (verified 2026-10-11).
-- Their code/owner/trigger bindings and application RLS/DML grants are unchanged.
-- No existing rows or session/auth credentials are changed.
--
-- Functions necessary for public Community reads or owner publish/RLS helpers
-- are intentionally excluded, as are auth signup and DDL event trigger.
--
-- The PostgreSQL trigger function EXECUTE ACL is consulted at CREATE TRIGGER,
-- not on routine firing; retain explicit service_role EXECUTE for future DDL.
DO $verify_trigger_targets$
declare v record;
begin
  for v in select p.oid,p.proname,p.prorettype::regtype::text return_type,
       (select count(*) from pg_trigger t where t.tgfoid=p.oid and not t.tgisinternal) as binding_count
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('prevent_locked_criterion_structure','prevent_locked_item_structure','prevent_locked_topic_structure','validate_rating_submission','validate_score_range')
  loop
    if v.return_type<>'trigger' or v.binding_count<>1 then
      raise exception 'R29 trigger precondition failed for %',v.proname;
    end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('prevent_locked_criterion_structure','prevent_locked_item_structure','prevent_locked_topic_structure','validate_rating_submission','validate_score_range'))<>5 then
    raise exception 'R29 expected 5 installed internal DML triggers';
  end if;
end;
$verify_trigger_targets$;
REVOKE EXECUTE ON FUNCTION
  public.prevent_locked_criterion_structure(),
  public.prevent_locked_item_structure(),
  public.prevent_locked_topic_structure(),
  public.validate_rating_submission(),
  public.validate_score_range()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.prevent_locked_criterion_structure(),
  public.prevent_locked_item_structure(),
  public.prevent_locked_topic_structure(),
  public.validate_rating_submission(),
  public.validate_score_range()
TO service_role;
DO $postcheck$
declare v record;
begin
  for v in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('prevent_locked_criterion_structure','prevent_locked_item_structure','prevent_locked_topic_structure','validate_rating_submission','validate_score_range')
  loop
    if has_function_privilege('anon',v.oid,'EXECUTE')
       or has_function_privilege('authenticated',v.oid,'EXECUTE')
       or not has_function_privilege('service_role',v.oid,'EXECUTE') then
      raise exception 'R29 invalid internal trigger privilege: %',v.proname;
    end if;
  end loop;
end;
$postcheck$;
