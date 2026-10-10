# R29 P2 internal Auth + event hook ACL audit

Read-only Supabase inspection (2026-10-11) confirmed:
- public.handle_new_auth_user() returns trigger, SECURITY DEFINER, bound once to enabled auth.users / on_auth_user_created_stats_maker.
- public.rls_auto_enable() returns event_trigger, SECURITY DEFINER, bound once to enabled ensure_rls / ddl_command_end.
- Both originally had PostgreSQL default PUBLIC EXECUTE (proacl NULL), no app RPC requirement.
- Neither function body, trigger binding, RLS policy, production rows, or authentication credential should be touched.

Security rationale: PostgreSQL checks EXECUTE at CREATE TRIGGER; pre-existing trigger firing is unaffected by revoking PUBLIC EXECUTE. P2 revokes PUBLIC, anon, authenticated on these two internal hooks only and preserves service_role. Guarded SQL verifies signatures and active bindings and performs ACL postchecks.

Pre-migration R29 advisor baseline: public SEC-DEF EXECUTE WARN anon=6, authenticated=9. Expected after migration: anon=4 and authenticated=7 if no concurrent changes, but independently verify with get_advisors.
Existing rows pre-change: topics=9, rating_sets=6, scores=190, criteria=59, topic_items=52. Community RPC effective access: legacy_authenticated=false, legacy_anon=false, gateway_server=true, gateway_client=false.

Migration: R29_P2_INTERNAL_HOOK_EXECUTE_RESTRICT.sql
Rollback: R29_P2_INTERNAL_HOOK_EXECUTE_ROLLBACK.sql (restores effective PUBLIC EXECUTE; use only if necessary).
Do not reapply R29 P1.

After apply: verify hook binding/ACL and counts, rerun Supabase Security Advisor, confirm Cloudflare production smoke and guest signup/Google-Apple linking where possible. Never add fake ratings or manipulate real user accounts as tests.

**Intentionally excluded:** get_community_criterion_summary, get_community_item_summary, get_topic_participant_count, topic_is_viewable and auth owner/RLS helper functions, which need separate behavior review. Guest account RLS warnings may be intentional.
