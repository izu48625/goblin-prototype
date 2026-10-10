# Stats Maker — R28 Phase 2 security audit (2026-10-10)

## Scope and measured baseline
- GitHub main at audit start: `959a9bd714bf07a878862451154d9f8a5fc545b8`
- Cloudflare production OGP and 13/13 browser smoke passed.
- Data: 9 topics, 6 Community rating sets, 190 saved score rows.
- RLS enabled on `topics`, `criteria`, `topic_items`, `rating_sets`, `scores`.
- `save_my_topic_rating`: browser roles `anon` and `authenticated` denied EXECUTE.
- `gateway_save_my_topic_rating`: only `service_role` may EXECUTE.

## Finding and safe remediation
The five public data tables still grant `TRUNCATE`, `TRIGGER` and `REFERENCES` directly to both `anon` and `authenticated`. This is unnecessary attack surface. Importantly `TRUNCATE` is not protected by RLS when SQL execution is available; reducing the grants is defense-in-depth, not proof that a client has exploited them. The application uses ordinary SELECT / INSERT / UPDATE / DELETE subject to RLS and/or vetted server RPCs. Retain those capabilities. The new migration revokes ONLY the three schema-management privileges from client roles, leaving `service_role` privileges intact.

The helper trigger function `public.set_updated_at()` has no fixed `search_path`, flagged by Supabase advisor. Its body is only `NEW.updated_at = now()`; set the path to `pg_catalog` without rewriting its SQL, owner, grants, or installed triggers.

Files: `R28_P2_PRIVILEGE_CLEANUP.sql` and separately reviewed `R28_P2_PRIVILEGE_ROLLBACK.sql`. Apply only via a named Supabase migration, then verify zero extra grants, proper RPC ACLs, unchanged data counts and complete production QA.

## Additional warnings — reviewed, NOT automatically changed
Supabase reports multiple `SECURITY DEFINER` functions callable by `anon` or `authenticated`:
- Aggregate summary functions and `topic_is_viewable` must remain available to the public work/Community views until separately checked.
- Auth and validation trigger functions default to PUBLIC EXECUTE. Their direct invocability is limited by PostgreSQL's trigger-function calling rules, but reducing broad grants requires paired registration/signup and publication testing. Defer to a dedicated, reversible change.
- Private write-budget functions are server-only, protected by their ACLs, and are intentionally exempt from public RLS policies.

## Remaining supervised real-device QA
1. iPhone Safari: export/save a sample **Heatmap** PNG, then Waffle and Stat Board. Verify the iOS share sheet saves a real readable image, not just an in-memory preview.
2. Publish a newly created throwaway work as URL-limited (Unlisted) under the user's direction only; verify discover exclusion, sharing, visibility and owner edits. Avoid creating extra works during automated tests.
3. Community: in iPhone Safari verify existing participant score updates preserve participant count, with optional Turnstile challenge, then re-query DB.
4. Recovery: verify original local sheets, JSON backup/restore, rollback plan and production QA.

No new paid services, automatic production data edits, or forced security cutover.

## Applied-migration results (2026-10-10, UTC 13:27)
- Migration `20261010132709_r28_p2_client_least_privilege` applied successfully via Supabase migration runner.
- Verified all `anon` and `authenticated` `TRUNCATE`, `TRIGGER`, `REFERENCES` table privileges are **false** on all five tables.
- Original SELECT/INSERT/UPDATE/DELETE ACLs remain unchanged, and service_role privileges were not edited.
- `set_updated_at()` has `search_path=pg_catalog`; installed triggers were not changed.
- Data before/after: topics 9/9, rating sets 6/6, scores 190/190, criteria 59/59, items 52/52.
- Legacy browser rating RPC inaccessible to `anon`/`authenticated`. Privileged gateway service_role EXECUTE true, authenticated EXECUTE false.
- Supabase still reports public/authenticated SECURITY DEFINER callability warnings; these are **not all exploitable or safe to revoke indiscriminately** and require dedicated function-by-function testing. Also private write-budget RLS/no-policy alert is expected for server-only table.
- GitHub production smoke: 13/13 passed on R28 PNG release before DB grant cleanup; full live iPhone save/publish regression remains supervised and outstanding.
