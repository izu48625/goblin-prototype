# Stats Maker R26 — Abuse Protection

## P1 — Cloudflare edge throttling (deployed with release r26p1)

The Cloudflare Worker protects public, potentially expensive proxy routes:

| Endpoint | Worker limiter | Window | Scope |
| --- | --- | --- | --- |
| `/api/og` | `OG_RATE_LIMIT` | 90/minute | per connecting IP per Cloudflare location |
| `/p/:id` | `SHARE_RATE_LIMIT` | 300/minute | per connecting IP per Cloudflare location |

Blocked calls return **429** and **Retry-After: 60**. Rate limiting is
intentionally permissive to limit false positives for shared networks and crawlers.
It applies only to GET/HEAD and is not a precise global usage counter.

- Wrangler native bindings: `2601`, `2602` (unique to this Worker).
- No new secrets, environment variables, or database migration for P1.
- The existing OGP backend remains Vercel Stage 1.
- Automated preflight tests verify blocking occurs before the external origin is contacted.
- All existing editor / anonymous Community routes stay unchanged.

## Critical security limitation (not complete yet)

**Publish and Community writes currently go from the browser directly to the
Supabase REST/RPC endpoint.** A Turnstile widget or rate limit on the
Cloudflare Worker by itself cannot secure those database writes. The Supabase
publishable key is public by design; hiding it is not a security measure.

Supabase already enforces: RLS owner restrictions, one submitted rating set per
user/topic, and the minimum-five-users Community aggregation privacy gate. But
an attacker can create new anonymous identities and bypass per-user quotas.

## P2 — Database write guards (installed 2026-10-10; live UI test remains)

Applied by the account owner using `R26_P2_DB_GUARDS.sql` in the Supabase SQL Editor.
Read-only verification against production confirmed:

- `private.write_budgets` and `private.consume_write_budget` exist.
- Topic creation and updates have a write-budget trigger.
- Community RPC remains executable for authenticated (including anonymous) users.
- Direct browser `INSERT/UPDATE/DELETE` on `rating_sets` and `scores` are revoked.
- Five previously submitted rating sets remain intact after installation.
- Identity quotas: 30 new topics/day, 120 topic updates/hour, 60 rating saves/hour.
- Maximum per-request rating payload: 400 cells; title/description/snapshot size ceilings.

**Remaining QA:** Confirm one real device can still publish/update a topic and
submit/update its own Community rating. SQL inspection alone is not an
authenticated, user-level end-to-end mutation test. Never artificially inflate
public Community counts for QA.

## P3 — Turnstile and write gateway (code staged; not yet enforced)

**R26 P3 staging** provides an optional, default-off Worker
`POST /api/guard/community` and `GET /api/security/config`, plus a
browser-side dynamic Turnstile challenge for Community and Remix votes.
It does not activate automatically or break the existing anonymous flow.

Implemented checks before saving a rating:
- Only `https://statsmaker.app` accepted as the browser origin.
- Incoming JSON limited to 100 KB; max 400 scores.
- Valid authenticated Supabase anonymous-user JWT verified by Auth API.
- Per-IP Worker throttle at 30 requests/minute.
- Cloudflare Siteverify response must be successful, have the exact
  `statsmaker.app` hostname and `community_submit` action, and be fresh.
- Verified submissions preserve the user's JWT (no service-role key) and
  forward only the rating payload to the existing DB RPC.
- No secret key is ever embedded in a browser file.
- Tests simulate wrong origins, malformed requests, blocked rate limits,
  bad sessions, invalid/expired/wrong-host challenges, and successful writes.

### What the user must configure before staging can be enabled

1. Cloudflare Dashboard → Turnstile → Add widget:
   name `Stats Maker Community`, domain `statsmaker.app`,
   widget type Managed. This is available on the free tier.
2. Cloudflare Dashboard → Workers & Pages → `stats-maker-web`
   → Settings → Variables and Secrets.
3. Add environment variable `TURNSTILE_SITE_KEY` = widget's public sitekey.
4. Add **secret** `TURNSTILE_SECRET` = Turnstile secret; never paste it
   into chat, GitHub, or browser code.
5. After P3 QA, enable Worker environment variable
   `TURNSTILE_COMMUNITY_STAGE` = `1` to show challenges on normal
   Community submissions. Disabled by default; activate only after testing
   and explicit approval.

### P3 readiness QA (keys installed; enrollment still disabled)

- `GET /api/security/config` exposes only a boolean
  `turnstileConfigured` to confirm the Worker sees both key names/values.
  The actual secret value is never returned; `siteKey` stays null while
  `communityGatewayEnabled` is false. It cannot validate whether the
  secret and sitekey belong to the same widget without a real Siteverify call.
- Production Smoke asserts that the configured keys are available at runtime
  and that the gate remains **disabled** until a separate authorization
  migration and tested write-path cutover. This check is read-only.
- Production Community/Remix clients now fail closed when the Worker security
  config endpoint returns an HTTP error, malformed content, or a network
  failure. A confirmed `communityGatewayEnabled:false` response still
  preserves legacy behavior. GitHub Pages and local previews retain direct
  RPC by design.
- Cloudflare dashboard runtime variables are preserved across Wrangler
  deployments by `keep_vars: true`. Never commit the private key to GitHub.
- No Supabase permissions were revoked as part of this readiness patch.

### Important: the gateway alone is NOT a bypass-proof security boundary

The existing Supabase `save_my_topic_rating` RPC is still callable directly
by anonymous-authenticated browser clients, so a malicious user can bypass
Turnstile. This staging version cannot claim to prevent automated Community
submissions. **Do not call P3 complete** until the direct write route is
closed through a separate service-only DB function / trusted gateway cutover
and tested with an anonymous browser session. Publishing likewise still
uses direct multi-table Supabase writes and requires its own atomic,
verified server-side flow.

The Turnstile token lasts five minutes and is single-use. The browser does
not permanently store it; each fresh verified submission needs a new token.
One-off previews and GitHub Pages continue to use the old RPC path.

### Remaining rollout plan

1. Create a Turnstile widget restricted to `statsmaker.app`. Keep the
   sitekey public; set the secret as a **Cloudflare Worker secret**.
2. Route relevant write operations via a Cloudflare Worker endpoint that
   verifies Turnstile through Siteverify on the server.
3. Bind writes to the user's authenticated anonymous JWT and perform the RPC
   on their behalf; do not use a service-role key in the browser.
4. Close direct Supabase write routes via DB authorization so attackers cannot
   bypass the Worker. Publishing includes multi-table writes, so it requires
   an atomic server-side API/RPC, not just proxying the existing browser calls.
5. Check verified hostname/action, token expiration and one-time use; reset the
   widget after each submission. Support anonymous users without sign-up.
6. Verify rollback behavior; do not enable compulsory Turnstile until the
   full write path works and is tested.

## Staging rollback

Remove `TURNSTILE_COMMUNITY_STAGE` (or set it to `0`) in the
Cloudflare Worker environment to immediately return to the original
Community RPC flow. A refresh re-fetches gateway configuration.
This is possible without removing any user ratings.

## Rollback

Revert `worker/index.js` and `wrangler.jsonc` via main to remove P1.
P1 leaves Supabase permissions/data entirely unchanged.
