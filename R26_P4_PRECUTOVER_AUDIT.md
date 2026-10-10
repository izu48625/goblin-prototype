# Stats Maker R26 P4 — Pre-cutover Security Audit

Date: 2026-10-10. Scope: Community write authorization; static review of GitHub main and read-only verification of production Supabase. This is **not** a penetration test or a successful real-user write test.

## Decision

**NOT YET APPROVED for TURNSTILE_COMMUNITY_STAGE=1 or CUTOVER.**

No confirmed critical exploit was demonstrated during this read-only inspection. The legacy rating RPC is **still directly executable by authenticated identities by design** until cutover, so bypass resistance is **not** yet active. Prior to cutover: finish Worker secret configuration, stage one real anonymous submission/update, verify no duplicate participation, and prepare a joint Worker/DB rollback.

## Verified safeguards

- The new `public.gateway_save_my_topic_rating(uuid,uuid,jsonb,boolean)` is `SECURITY DEFINER` owned by `postgres`, with `search_path=''`. EXECUTE: `service_role=true`, `authenticated=false`, `anon=false`.
- The legacy `public.save_my_topic_rating(uuid,jsonb,boolean)` uses `auth.uid()`, validates topic access and scores, and applies the P2 60/hour identity budget. It is `authenticated=true` until supervised cutover; `service_role=false`, but its `postgres` owner can invoke it through the wrapper.
- The wrapper sets the transaction-local subject claim from the Worker-authenticated user, then verifies `auth.uid()=p_user_id` before invoking the legacy RPC. Current `auth.uid()` definition reads this claim first. Identity forwarding still requires a real integration test.
- Worker verifies the end-user JWT using Supabase Auth, Turnstile siteverify hostname/action/freshness, request size and score count, and forwards only the Auth-verified user ID with a server-side service-role JWT. Invalid/malformed responses fail closed. Service credentials are not placed in frontend files.
- Database snapshot at audit: **5** rating sets, **176** scores. The migration `r26_p4_prepare_gateway` is installed. No writes, grants, key changes or stage changes were made as part of this audit.

## Findings and mitigation

| Severity | Finding | Required disposition |
| --- | --- | --- |
| HIGH (availability/rollout) | `cloud/community-gateway.js` cached `communityGatewayEnabled=false` for the lifetime of an open tab. After cutover that tab would keep invoking the revoked legacy RPC and fail to save. | Fix and test a disabled-to-enabled configuration transition before cutover; invalidate configuration on **every submission**. This audit PR implements that client-only change. |
| HIGH (release gate) | The real Cloudflare Worker-to-PostgREST-to-DB-to-anonymous-user saving path has not yet been run with the new secret and an actual Turnstile token. Mock tests and SQL ACL checks cannot prove persistence or that role/claim forwarding works in PostgREST. | Use a controlled current-user rating, verify saved ID/status, update the **same** rating, confirm count unchanged, and verify other identities cannot edit it. No production test writes without user supervision. |
| MEDIUM (defense in depth) | `anon` and `authenticated` roles retain `TRUNCATE`, `TRIGGER`, and `REFERENCES` privileges on five application tables, including `rating_sets` and `scores`. These privileges do not establish a direct browser Data API exploit by themselves, but are unnecessarily broad if an SQL-execution route is later exposed. | Plan a separate, tested permission-reduction migration with a rollback. **Do not revoke in this audit** because permissions cleanup is outside P4 and real publish/rating E2E must be protected. |
| MEDIUM (design) | The public `/api/security/config` endpoint reports runtime key readiness by booleans, not key validity. A configured key can be expired/wrong even when readiness is true. | Validate through Auth + Turnstile + RPC in supervised staging; reject failures and do not CUTOVER early. |
| MEDIUM (rollout) | The worker's stage-off fallback is deliberately the legacy RPC. Once CUTOVER revokes its EXECUTE, turning off only the Worker stage will cause broken writes. | Enforce paired rollback: stage 0 **and** `R26_P4_ROLLBACK.sql`; verify direct RPC restoration. |
| MEDIUM (future phases) | Publish/Remix create or modify topics/items/criteria through browser-to-Supabase writes and remain outside the Community gateway. | Track as the distinct Publish security phase; do not imply that P4 closes all write paths. |
| LOW (scope/intentional) | Supabase Security Advisor flags anonymous sign-ins and several accessible `SECURITY DEFINER` functions, including read-only community aggregation and trigger functions. Many are intentional or not directly executable as normal RPCs; review those grants in the later full audit. | Avoid blanket REVOKE or disabling anonymous auth without compatibility testing. |

## Cutover preflight: blocking requirements

1. Existing production runtime Turnstile Site Key / Secret remain secret-backed and valid, with the same registered hostname/action.
2. Add `SUPABASE_SERVICE_ROLE_KEY` as a **Cloudflare runtime secret**, using the legacy `service_role` JWT expected by this Worker. Never paste in ChatGPT, GitHub, logs, or browser code. No purchases or plan changes.
3. Confirm `GET /api/security/config` shows `trustedGatewayConfigured=true` without returning the secret. This is only a shape/role hint, not a full credential validation.
4. Temporarily stage `TURNSTILE_COMMUNITY_STAGE=1` **with explicit user agreement** while the legacy RPC remains available. Supervise real iPhone Safari anonymous save and re-save, no duplicate participant. Confirm failed Turnstile causes no write and a malicious client-supplied user ID is ignored.
5. Check `R26_P4_CUTOVER.sql` prerequisite ACLs, rollback script, and known baseline counts/IDs. Apply CUTOVER **only after** a successful stage write and restore readiness.
6. After cutover, confirm direct RPC access from `anon/authenticated` fails and Worker save succeeds. Monitor errors and preserve a paired rollback.

## Evidence

- GitHub: `worker/community-gateway.js`, `cloud/community-gateway.js`, `R26_P4_PREPARE_GATEWAY.sql`, `R26_P4_CUTOVER.sql`, `R26_P4_ROLLBACK.sql`, `scripts/r26-gateway-test.mjs`.
- Supabase read-only queries: `pg_proc` (function owner, ACL, definition), `has_function_privilege`, `information_schema.role_table_grants`, `pg_policies`, `rating_sets` and `scores` counts, and Security Advisors.
- The production Smoke previously passed all ten HTTP/browser checks **while the gateway was disabled**. This validates preservation of existing screens, **not** the privileged live write path.
