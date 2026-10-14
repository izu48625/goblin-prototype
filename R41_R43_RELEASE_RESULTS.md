# R41–R43 Discover scale rollout record

As of 2026-10-14 JST. Scope: Stats Maker Discover; source PR #167.

## Implementation
- **R41**: transactionally backfilled `private.discover_counters`, incrementally maintained per-topic counts using atomic SQL row updates; dedicated Public-only counter reader functions. Shared `get_topic_participant_count` remains unchanged. Private counters have RLS and no anon/authenticated table grants.
- **R42**: current Public visibility, category pushdown, trigram GIN indexes on normalized Japanese/English search text covering title, description, target names and criterion names. Literal multi-term matching and R40 response shape retained.
- **R43**: same-origin Cloudflare Worker `/api/discover`, 20-second **ID-and-ranking-only** cache for the first newest/popular page. On EVERY cache hit, fresh hydration from a SECURITY INVOKER Public-only Supabase function before returning any data; on missing/revoked IDs recompute. Unlisted and Private cannot be served from the cached body because topic content is not stored in cache. 90-per-minute Worker rate limit; this does **not** prevent bypassing the Worker to query the separately public Supabase RPC. Client falls back to R40 RPC on gateway outages, but not HTTP 429/400.
- `discover.html` JS revision bumped for iPhone Safari cache refresh. Public site UI and 12-at-a-time cards unchanged.
- `R41_R43_RELEASE_MIGRATION.sql` and `R41_R43_RELEASE_ROLLBACK.sql`: single transaction release and R40 restoration.

## QA evidence
- Existing original R40 vs R41+R42: 14 JA/EN/category/sort/search cases returned exactly matching rows and totals in DB transaction. Further nine combined-migration baseline cases were run in rollback transaction.
- R41 lifecycle: 8 scenarios all passed in temporary throwaway schema, including draft→submitted, repeated status, Public/Private toggle, Remix→version, rating deletion, child deletion.
- R41 concurrent writes: GitHub Actions PostgreSQL 17 isolated service, 16 parallel inserts then 16 parallel deletes, checked exact counters; passed.
- R43: mocked cloud gateway verifies cached entries contain **only IDs** (not snapshots), content rehydration on hit, Public→Private and Public→Unlisted removal, fresh-public updates, manual refresh and abuse validation. Node workflow passing.
- Existing Cloudflare Preflight and R40 12-card pagination QA passing.
- No added paid search/cache vendors; current Cloudflare and Supabase resources only.

## Residual risk / follow-up
- Search can still scan many rows for short (<3-character) terms, and exact total count evaluates matching rows; GIN performance at 100k real stored works still needs an isolated load test.
- 20-second cache can temporarily delay appearance of newly published works and keep count metadata stale; **content/visibility are checked live** before every cached response. HTTP response is no-store.
- If a work changes visibility between live DB hydration and the HTTP response, there is an ordinary read/response race window, as with any direct database read. Long-lived cached content is not used.
- Parallel rating writes were tested; complex simultaneous topic source reassignment and cascading account deletes at scale remain less exercised.
- Query `/api/discover` rate limit cannot cover direct public Supabase RPC. Full protection would require architecture changes and is deferred.
- No guarantee for 100,000+ Public works or extremely high concurrency without another benchmark.

## Release order
1. Verify all PR checks and existing live site/DB baseline.
2. Apply the single transaction Supabase SQL migration **before** merging the code. If DB fails, do not merge.
3. Smoke-test new public RPC and hydrate function under anon role, verify only Public entries.
4. Merge PR. Confirm main HEAD, CI, Cloudflare deploy to statsmaker.app, iPhone Safari Discover behavior.
5. On failure, revert frontend/Worker deployment first, then apply R40 DB rollback. R40 reads can continue using current DB until rollback.
