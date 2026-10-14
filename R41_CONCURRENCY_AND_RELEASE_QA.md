# R41 Readiness Checks (no production write)
Date: 2026-10-14

## Changes verified in rollback-only transaction
- `R41_DISCOVER_COUNTERS.sql` creates the private counter table, trigger functions and backfills the current Public works.
- `R41_DISCOVER_COUNTER_READERS.sql` adds only explicitly authorized counter read functions; direct table SELECT stays forbidden to anon/authenticated.
- `R41_DISCOVER_RPC_COUNTER_CUTOVER.sql` preserves the existing Discover signature and the Public-only filter.
- `R41_R42_ROLLBACK.sql` restores the original R40 RPC and removes the private counters. A full install-and-rollback transaction succeeded.
- Concurrent refresh logic now acquires a lock on the affected topic record; **this is not a concurrency stress test**.

## Mandatory blocking tests before deploying
- Test simultaneous rating submit/update/delete and publication visibility transitions in **an isolated DB project or branch**, not in production.
- Check counts against independent SQL aggregates after each operation, including Remix/version source reassignment and owner deletion cascades.
- Avoid deadlocks: test two updates that touch overlapping parent/source topics, with reverse lock order.
- Check Public->Private and Public->Unlisted revocation immediately on every API access.
- Benchmark before/after on at least 10k and 100k synthetic stored topic/rating rows on the test DB.
- R42 search projection is not yet implemented; R42 category-only expression index does not accelerate the current substring search predicate.
- R43 CDN cache is not yet implemented: no caching of full work snapshots before a revocation-safe freshness scheme.

## Deployment decision
NO-GO for production. Keep Draft PR #167 and R40 site. The safety checks above remain open.
