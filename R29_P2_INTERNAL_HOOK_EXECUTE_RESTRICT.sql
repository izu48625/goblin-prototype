-- R29 P2: revoke direct RPC EXECUTE from internal Auth/DDL hooks.
-- No function body, trigger binding, DML permission, RLS policy, or row changes.
DO $precheck$
DECLARE
  v record;
  c integer;
BEGIN
  SELECT p.prosecdef AS definer,p.prorettype::regtype::text AS return_type INTO STRICT v
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='handle_new_auth_user' AND p.pronargs=0;
  IF NOT v.definer OR v.return_type <> 'trigger' THEN
    RAISE EXCEPTION 'Unexpected Auth hook signature';
  END IF;
  SELECT COUNT(*) INTO c FROM pg_trigger t
    WHERE t.tgfoid='public.handle_new_auth_user()'::regprocedure
      AND NOT t.tgisinternal AND t.tgrelid='auth.users'::regclass
      AND t.tgname='on_auth_user_created_stats_maker' AND t.tgenabled='O';
  IF c <> 1 OR (SELECT COUNT(*) FROM pg_trigger t WHERE t.tgfoid='public.handle_new_auth_user()'::regprocedure AND NOT t.tgisinternal) <> 1 THEN
    RAISE EXCEPTION 'Unexpected Auth trigger binding';
  END IF;
  SELECT p.prosecdef AS definer,p.prorettype::regtype::text AS return_type INTO STRICT v
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='rls_auto_enable' AND p.pronargs=0;
  IF NOT v.definer OR v.return_type <> 'event_trigger' THEN
    RAISE EXCEPTION 'Unexpected DDL hook signature';
  END IF;
  SELECT COUNT(*) INTO c FROM pg_event_trigger e
    WHERE e.evtfoid='public.rls_auto_enable()'::regprocedure
      AND e.evtname='ensure_rls' AND e.evtevent='ddl_command_end' AND e.evtenabled='O';
  IF c <> 1 OR (SELECT COUNT(*) FROM pg_event_trigger e WHERE e.evtfoid='public.rls_auto_enable()'::regprocedure) <> 1 THEN
    RAISE EXCEPTION 'Unexpected DDL event trigger binding';
  END IF;
END;
$precheck$;

-- Existing trigger firing does not need PUBLIC EXECUTE; service_role remains explicit.
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user(), public.rls_auto_enable()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user(), public.rls_auto_enable()
TO service_role;

DO $postcheck$
DECLARE v record;
BEGIN
  FOR v IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('handle_new_auth_user','rls_auto_enable') AND p.pronargs=0
  LOOP
    IF has_function_privilege('anon',v.oid,'EXECUTE')
       OR has_function_privilege('authenticated',v.oid,'EXECUTE')
       OR NOT has_function_privilege('service_role',v.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'R29 P2 invalid hook ACL: %',v.proname;
    END IF;
  END LOOP;
  IF (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('handle_new_auth_user','rls_auto_enable') AND p.pronargs=0) <> 2 THEN
    RAISE EXCEPTION 'R29 P2 expected 2 internal hooks';
  END IF;
END;
$postcheck$;
