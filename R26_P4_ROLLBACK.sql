-- Stats Maker R26 P4 / EMERGENCY ROLLBACK (RUN ONLY IF NEEDED)
-- FIRST remove TURNSTILE_COMMUNITY_STAGE in Cloudflare (or set it to 0),
-- then run this SQL to restore the pre-cutover anonymous-user RPC.
-- No ratings or scores are deleted or rewritten.

begin;
grant execute on function public.save_my_topic_rating(uuid,jsonb,boolean)
  to authenticated;
notify pgrst, 'reload schema';
commit;

select
  has_function_privilege('authenticated',
    'public.save_my_topic_rating(uuid,jsonb,boolean)','EXECUTE') as restored_browser_rpc;
