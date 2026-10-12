# STATS MAKER — R37 P4 Release Gate

**Phase:** R37 P4 — Final integrated QA before R38  
**Date:** 2026-10-12  
**Base:** main commit `217ab41bd30c81d963e41fe0f5b38ce9b61db20d` (R37 P3)

## Goal

Validate the *already shipped* user experience and existing security/data safeguards as one release. No account redesign, storage migration, new features, third-party billing, ad delivery, analytics activation or production database writes.

## Execution

Run [R37 P4 Final Release Regression Gate](.github/workflows/r37-p4-final-release-qa.yml) on the pull request. Reuse original regression scripts rather than developing duplicates. All browser sessions use an isolated local `dist/` server; mocked publishing tests cannot submit real ratings, public works, reports or inquiries.

| Area | Test coverage |
| --- | --- |
| Local-first 40×10 | 100-point and 10-point data, repeated edits, multi-sheet reloads |
| Long session and recoverability | 100 edits, 16 sheet switches, long text, embedded images, JSON import/export, invalid and legacy JSON, storage quota and Undo, stale tabs |
| Ten graph types | launcher + source mapping, renderer native PNG, long JP labels, crowded Scatter |
| iPhone-equivalent UI | viewport 320/390/430px, modal and keyboard sizing, WebKit native-PNG preview and share mock |
| Sharing and permissions | URL-limited/Public/Private, post-revocation share and OG authorization, Public-only Discover and SEO |
| Community and Remix | score identity, sorting invariants, ten visual snapshots, Remix lineage and isolated mock publishing |
| Discovery and localization | Discover visibility, JA/EN introduction and navigation, help/terms/privacy/contact |
| Privacy and operations | reporting/inquiry/RLS contracts, no GA4/real ad delivery, production-safe regression design |

## Exit gate

1. PR's three integrated jobs **and any other required checks must succeed**.
2. Merge through a PR only after checking the current main/head.
3. Verify GitHub Pages deployment, Cloudflare preflight and **Production Smoke Test against the exact new main SHA**.
4. Report exact PR number, merged commit SHA, link to the site, CI status and outstanding limitations. A PR-green result alone is not evidence that Cloudflare deployed.
5. Never touch real user projects, ratings, contacts, reports, accounts or production Supabase data in QA.

## Known limits (not an R37 P4 failure by themselves)

- Real iPhone OS share sheet and Photos save need a physical-device check; Playwright WebKit is not a hardware iPhone.
- LocalStorage cannot prevent browser data clearing, lost devices or a sub-millisecond concurrent-tab race; advise periodic JSON backup.
- External SNS caches and the legacy Vercel OG endpoint still require separate consideration.
- Search Console property verification and sitemap submission are pending the user/PC operation.
- GA4 and AdSense remain inactive until explicit approval. A passing QA does not mean the application has been accepted for AdSense or legally reviewed by counsel.
