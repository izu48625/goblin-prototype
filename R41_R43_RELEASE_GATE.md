# R41–R43 Discover scale hardening — rollout and acceptance

2026-10-14. GitHub source: R40 main `5dc79873ece86bc03cf09885b7de93399ef0275a`.

## R41: ranking counters — SQL authored, transaction-tested, NOT deployed
- `R41_DISCOVER_COUNTERS.sql`: internal `private.discover_counters` with topic ID, participant, Public Remix counts, trigger-maintained when ratings or publication visibility/lineage change.
- Initial backfill gives a snapshot of existing counts without modifying user works or scores.
- `R41_DISCOVER_COUNTER_READERS.sql`: privacy-guarded aggregate readers. Existing `get_topic_participant_count` signature preserved.
- Both files tested inside BEGIN/ROLLBACK with local `anon` role; no persistence.
- Caveat: SQL uses privileged counting functions. Independent security review, concurrent update tests, and full published/unlisted/private lifecycle regression are REQUIRED before any application of these migrations.

## R42: search optimization — only helper index drafted
- `R42_DISCOVER_CATEGORY_INDEX.sql` is additive and transaction-tested.
- The current R40 RPC computes normalized substring matching over title, description, rows and criteria from JSONB; this index alone cannot accelerate that complex expression. Search projection table/GIN trigram / indexed normalized text needs a separate correctness and privacy review before deploying.
- Do not claim R42 full-search scalability is complete.

## R43: caching — implementation intentionally NOT deployed
- Current browser calls Supabase RPC directly; a Cloudflare CDN cache would NOT intercept it.
- Proposed: proxy Public-only queries via a new Worker endpoint with strictly allowlisted filters, no cookies/tokens, fixed limit, no per-user data.
- **Crucial**: either have a robust invalidation mechanism for visibility revocation OR cache only public IDs and verify current Public visibility at serving time. Never serve cached full snapshots blindly because a Public work can be made Private/Unlisted at any time.
- Until that revocation guarantee is implemented and tested, keep Discover uncached rather than risk a privacy leak.
- Preserve the R40 fallback and never cache an authenticated user's personal data.

## Validations performed
- R41 counter construction + anon aggregate read under `BEGIN; ... ROLLBACK`: passed on 11 Public works.
- Combined R41 + R42 creation and rollback in a single transaction: passed; internal counter table removed after rollback.
- No persistent Supabase DDL run; no R41/R42/R43 application changes were merged or deployed.
- Production site remains on R40.

## Pre-deployment QA
1. Fresh/public/unlisted/private, publish/unpublish/republish, delete/remix/version, submitted/draft/cancel ratings, user deletion/ON DELETE CASCADE.
2. Concurrent writes test to confirm counters cannot drift and no deadlock in trigger lock ordering.
3. Compare every counter against independently computed aggregate in DB.
4. Anonymous API permissions and Supabase security advisor review.
5. 1k/10k/100k isolation testing and 1/5/20 concurrent visitors in a non-production environment (cost review first).
6. R43 CDN stale-revocation tests, including cache hit after Public→Private/Unlisted. No cache of unreleased content.

## Continued implementation and regression (2026-10-14)
- Added `R41_DISCOVER_RPC_COUNTER_CUTOVER.sql`: replaces both inline Public-remix descendant counts in the existing R40 Discover RPC with the privacy-guarded R41 reader. Signatures and API shape remain unchanged.
- Fixed rollback ordering: restore the original R40 Discover RPC BEFORE dropping the new reader function.
- Verified creation, cutover, and rollback within one transaction; R40 restored successfully.
- Ran anon-role comparison of the original and counter-backed rankings for newest/popular/community/remix against all 11 existing Public works. All returned the same total (11) and identical ordered IDs.
- This is NOT proof of concurrency-safe counter maintenance: trigger deadlocks, rating re-submissions, simultaneous Public/Private edits, deletes and cascades remain untested; full search projection and Cloudflare cache remain not implemented.
- Production database and site remain unchanged by this PR. Keep as Draft.
