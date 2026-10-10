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

## P2 — Database write guards (pending)

1. Apply transactional, server-side per-identity quotas to public-topic creation
   and the `save_my_topic_rating` RPC.
2. Remove unnecessary direct `INSERT/UPDATE/DELETE` privileges on
   `rating_sets` and `scores` so the validated RPC is the only write path.
3. Test existing anonymous vote creation/update and publishing before release.
4. Do not expose the internal quota implementation through PostgREST.
5. Track quota violations and use clear client-facing retry messages.

## P3 — Turnstile and write gateway (pending)

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

## Rollback

Revert `worker/index.js` and `wrangler.jsonc` via main to remove P1.
P1 leaves Supabase permissions/data entirely unchanged.
