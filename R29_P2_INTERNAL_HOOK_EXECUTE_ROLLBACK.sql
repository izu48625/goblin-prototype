-- R29 P2 rollback: restore pre-P2 EFFECTIVE grants (both functions previously proacl=NULL).
-- Restores PUBLIC EXECUTE; only apply after confirmed regression.
-- Equivalent effective access; proacl representation may differ from original NULL.
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user(), public.rls_auto_enable() TO PUBLIC;
DO $check$
BEGIN
  IF NOT has_function_privilege('anon','public.handle_new_auth_user()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.handle_new_auth_user()','EXECUTE')
     OR NOT has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') THEN
    RAISE EXCEPTION 'R29 P2 rollback did not restore PUBLIC execute';
  END IF;
END;
$check$;
