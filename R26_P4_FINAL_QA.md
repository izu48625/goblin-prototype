# Stats Maker R26 P4 — Final Community Gateway QA

Date: 2026-10-10
Scope: **Community voting submission/update gateway only**, not a penetration test or
a blanket security certification for all Stats Maker features.

## Decision

**R26 P4 Community gateway cutover: PASS, subject to ongoing monitoring.**
The previous direct browser rating RPC has been revoked. The production Worker
Community gateway is enabled; real iPhone Safari submission and updates passed,
including an update after cutover. Publish/Remix writes are a separate security
workstream and are not certified here.

## Production version and automated evidence

- Final negative-probe code PR: #68, squash commit `5040a8a2b0e977dc22ae6f9e9c45de0f989b3248`.
- GitHub Production Smoke Test run `38038101699`: **success, 10/10**
  (HTTP production smoke and nine browser steps).
- Cloudflare Workers production build/deploy and GitHub Pages checks: **success**.
- HTTP stage configuration: `communityGatewayEnabled=true`,
  `turnstileConfigured=true`, `trustedGatewayConfigured=true`, and
  public sitekey present. No service role JWT or Turnstile secret in the response.
- Production HTTP negative tests (no normal rating writes):
  - GET Community gateway denied (405).
  - Disallowed Origin denied (403).
  - Non-JSON POST denied (415).
  - POST without user JWT denied (401).
  - Anonymous requests to old `save_my_topic_rating` and new
    `gateway_save_my_topic_rating` rejected (401/403/404).
  - These requests use an explicitly nonexistent topic UUID and only the
    public/publishable Supabase API key.

## Supervised iPhone Safari evidence

1. With stage=1 before DB cutover, real Community post of 7 scores on one
   target succeeded (participant count 1 -> 2).
2. Update of the same rating changed an example score 7 -> 8, with no
   duplicate participant; reload retained the score and "submitted" status.
3. After the DB cutover, the same user's "update rating" again returned
   the green Community success message, participant count remained 2,
   score 8 retained.
4. The browser challenge may be invisible when Turnstile passes automatically.

## Independent Supabase read-only verification

Immediately after phase-G production test:

| Observation | Result |
| --- | --- |
| `rating_sets` | 6 |
| submitted rating sets | 6 |
| `scores` | 183 |
| QA public topic submitted participants | 2 |
| legacy rating RPC EXECUTE for `anon` | false |
| legacy rating RPC EXECUTE for `authenticated` | false |
| privileged wrapper RPC EXECUTE for `service_role` | true |
| privileged wrapper RPC EXECUTE for `anon` and `authenticated` | false |
| `rating_sets` INSERT/UPDATE/DELETE for `authenticated` | false/false/false |
| `scores` INSERT/UPDATE/DELETE for `authenticated` | false/false/false |

The existing Community rating and score totals were unchanged by
the Phase-G deny-only probes.

## Operational safety and rollback

- **Leave `TURNSTILE_COMMUNITY_STAGE=1`** for normal Community submissions.
- Never place `SUPABASE_SERVICE_ROLE_KEY` in GitHub, public code, client
  JavaScript, SQL or screenshots. It remains a Cloudflare Production Secret.
- If normal ratings break, emergency rollback is **paired**:
  set/remove `TURNSTILE_COMMUNITY_STAGE=0` in Cloudflare **and**
  execute `R26_P4_ROLLBACK.sql` to re-grant the legacy RPC, followed
  by a browser test. Changing only one side can break submissions.
- `scripts/production-smoke.mjs` now intentionally asserts stage=1; a
  planned rollback also needs a conscious update to the stage expectation.
- No subscription, payment or third-party plan changes performed.

## Known limits and follow-up work (NOT part of this cutover)

- This is functional/security regression QA, **not a complete pentest**.
  Direct authenticated RPC execution was verified via PostgreSQL ACLs;
  HTTP denial probes used anonymous public-key requests, not a real user
  JWT performing adversarial RPC calls.
- `rating_item_notes` retains authenticated direct INSERT/UPDATE/DELETE
  with user-scoped RLS; the essential `rating_sets` and `scores`
  write privileges have been revoked. Review notes separately if needed.
- Supabase Security Advisor continues to warn about publicly callable
  `SECURITY DEFINER` functions (some intentionally public read functions
  and trigger routines), mutable `public.set_updated_at` search_path,
  anonymous sign-in/RLS and leaked-password protection. Review individually
  without blanket revokes that might break publish/rating.
- Performance Advisor flags 6 unindexed FKs, 27 RLS init-plan cases,
  9 multiple-permissive policy cases and a duplicate index.
- Future phase: separately audit and protect Publish/Remix writes and
  table grants; pursue service-wide security/performance audit.
- UI backlog observed during QA: duplicate "(Remix)" in title,
  dense mobile table with awkward name wraps and horizontal scrolling.

## Sources and reproducibility

- `R26_P4_PREPARE_GATEWAY.sql`
- `R26_P4_CUTOVER.sql`
- `R26_P4_ROLLBACK.sql`
- `worker/community-gateway.js`
- `cloud/community-gateway.js`
- `scripts/production-smoke.mjs`
- `scripts/r26-gateway-test.mjs`
- GitHub PR #68 and Production Smoke Test run `38038101699`
