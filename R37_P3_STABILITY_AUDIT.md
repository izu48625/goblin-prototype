# R37 P3 — Local-first backup and long-session safety audit

Date: 2026-10-12. Branch: `r37-p3-local-backup-multitab-guard`. PR: #138.

## Scope and current guarantees

- Preserve `statsMakerV014Library` and its previous `statsMakerV014PreRestoreBackup` when a storage-capacity failure aborts JSON restore. Checkpoint rollback occurs before reporting failure.
- Prevent an older HOME tab from overwriting data saved by another tab, including during Restore and Undo. Detect localStorage events and check the last known serialized value at write time.
- Do not write the entire library merely by opening a tab when a valid current library already exists. First-run and legacy migration continue to initialize storage.
- When storage is stale, hold the tab's in-memory state and explain in Japanese and English that the user should export JSON before reloading. Do not silently merge two different copies.
- Distinguish storage quota failures from invalid JSON at the restore UI.

## PR CI coverage

`scripts/r37-p3-backup-multitab-qa.mjs` uses a **disposable browser context** only, with Supabase traffic blocked. It checks:

1. A 40-target × 10-criterion sheet, a second sheet, Japanese/English text, embedded image data URLs and long notes.
2. 100 edits, 16 sheet switches, save debounce and reload consistency.
3. JSON download and import with row scores, image bytes and both sheets intact.
4. Deliberate quota exception on the final HOME write. Existing HOME bytes and the *preceding* Undo checkpoint both remain byte-for-byte unchanged.
5. Invalid JSON cannot alter current data or the last Undo checkpoint.
6. Two tabs: saving from the newer tab must not be erased by the older tab; the warning must be visible.

Additional CI regression uses `r30-storage-and-max-data-qa.mjs`, `r29-backup-restore-test.mjs`, `r37-local-40x10-endurance-qa.mjs`, `r36-ten-graph-label-png-qa.mjs` and `r36-webkit-iphone-share-qa.mjs`.

The WebKit test is an automated iPhone-like browser test. It **does not** validate a physical iPhone's operating-system share sheet or Photos save action.

## Limitations and follow-ups

- Browser localStorage is not a cloud backup. Device resets, private browsing, storage eviction, manually deleting site data or lost devices can still lose unsynced local work. Recommend periodic exported JSON backups.
- A backup JSON file up to 50 MB can be syntactically valid yet exceed the user's browser storage quota. The importer rejects the commit rather than deleting the existing data; there is no new storage migration in R37 P3.
- Concurrent writes within an extremely narrow inter-tab race are not a transactional compare-and-swap; the check and storage-event handling reduce ordinary accidental overwrites, not guarantee distributed locking.
- An old tab's in-memory unsaved changes can be exported, but they are not auto-merged with newer changes in another tab.
- Long sessions are tested with 100 edits and repeated exports in CI, not a physical device's memory pressure during multi-hour usage.
- The existing Vercel OG backend and third-party SNS caches are outside this phase; separately audit before a wider public launch.

## Acceptance

Do not mark complete until the PR checks are green and merged main has succeeded on Cloudflare Preflight, Production Smoke and deployment-related checks. No production topics, votes, reports or contact entries are modified by this QA.
