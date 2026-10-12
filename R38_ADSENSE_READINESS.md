# STATS MAKER — R38 P1 SEO / AdSense Readiness Audit

**Updated:** 2026-10-12  
**Source of truth:** `izu48625/goblin-prototype` / `main`  
**Scope:** Preparatory, non-monetized release work; no account signup, ad application, ad serving, paid APIs or change to any production Supabase record.

## Verified implementation

- The independent Japanese `/ja/` and English `/en/` pages already have unique localized copy, canonical URLs, reciprocal hreflang, descriptive titles, a clear entry into HOME and Discover, and links to localized terms, privacy and contact. Preserve their current introductions and compact cards.
- `/sitemap.xml` indexes static and dynamic sitemaps; Public-only `/work/:id` pages are the only work pages eligible to be indexed. Unlisted/Private are not added to the sitemap. The normal `/public.html` is noindex.
- Public SEO work pages now link directly to the localized **Terms / Privacy / Contact** sections. Only currently Public works are eligible for those pages. A reverted work returns a non-cacheable 404; unlisted is for direct URL viewing, not SEO indexing.
- The existing privacy policy and reports/contact system are already present; GA4 remains disabled, and `?adPreview=1` is **not** a real ad. No real AdSense code is added.
- A new `r38-readonly-readiness-qa.mjs` audit checks localized pages, headings, navigability, legal/contact links, public-only SEO, cache handling, no unexpected ad scripts, introductory-page compressed sizes and basic production response/timing observations. Network timing observations are **not** physical iPhone Core Web Vitals or a Google PageSpeed score.
- Existing R34 SEO, R35 legal/contact and R37 integrated tests remain authoritative; don't create duplicate functionality.

## AdSense site quality / outstanding editorial judgement

Google recommends *original, relevant content*, easy navigation and a useful visitor experience. No code test can guarantee site approval, copyright clearance, community moderation quality, or the usefulness of actual publicly posted work. A site owner should periodically moderate user-generated content and review visible public examples.

### Ads.txt

- No publisher ID has been authorized or verified. **Do not create an `ads.txt` with a fake `pub-` ID.**
- After AdSense account creation and explicit user approval, use the account's exact ads.txt line and place it at `https://statsmaker.app/ads.txt`, with a corresponding build/deployment check.
- Creating or applying for an account, changing DNS, uploading site-verification tokens and inserting AdSense scripts are **out of scope** until approved.

### Region-specific consent

- If serving personalized ads in the EEA, UK or Switzerland, review Google's requirement for a certified TCF-integrated CMP and choose an approved option (Google Privacy & messaging is one possibility), while also checking applicable privacy law and geographic audience.
- Do **not** invent a home-grown banner as a substitute for a certified CMP, and do not enable ad targeting or GA4 without user signoff.

Google source references (checked 2026-10-12):
- https://support.google.com/adsense/answer/7299563?hl=en (site quality and unique content)
- https://support.google.com/adsense/answer/12171612?hl=en (ads.txt and publisher ID)
- https://support.google.com/adsense/answer/13554116?hl=en (CMP requirements)

## Work requiring site-owner action

1. **Google Search Console**: sign in, verify `statsmaker.app` ownership, submit `https://statsmaker.app/sitemap.xml` and inspect the actual page-indexing and search performance reports. Never mark submitted without observed success.
2. **AdSense**: once quality and rights moderation is satisfactory, get express approval before opening/applying with an account, inserting verification/ad scripts, creating ads.txt with the real publisher ID, or changing ad-serving settings.
3. **Legal operation**: confirm genuine operator information, privacy request handling, retention times and any country-specific obligations; do not invent names, addresses or response guarantees.
4. **Old Vercel legacy share/OG**: the repository contains the revocation/no-store fix but the old separate host's deployed version and historic CDN/SNS caches are not guaranteed. Its independent direct-host behavior should be checked without changing production content.
5. **Physical iPhone QA** remains a separate R36/R37 outstanding item, intentionally not a blocker for preparing R38.
6. **Marketing/content samples**: original public showcases for search and creators require selection/rights review; don't fabricate users, upload dummy public works, or scrape copyrighted content.

## Release gate for R38 P1

- PR tests succeed for local SEO, Source SEO regression and static bundle.
- Squash merge via PR only; record full SHA.
- After merge, Cloudflare Preflight, Production Smoke, GitHub Pages, R34 SEO and R38 read-only live tests pass for the new main.
- If an external service blocks a GET or fails to deploy, report it explicitly rather than claiming account access, indexing or AdSense approval.

## R38 P2 update — legacy direct OG diagnosis

Read-only production diagnostic (2026-10-12) against the historic `stats-maker-ogp.vercel.app` host:

- Direct `/p/<nonexistent UUID>`: HTTP 404, `Cache-Control: no-store`.
- Direct `/api/og?id=<nonexistent UUID>`: HTTP **200**, `Cache-Control: public`. This does not by itself prove a leak of a revoked work's data, but shows the old host is **not conforming to the R37 P4 source-level fail-closed/no-store expectations**.
- Production `https://statsmaker.app/api/og` remains subject to the Cloudflare request-time visibility gate.
- R38 P2 switches GitHub Pages and localhost-generated *new share links* to the official `https://statsmaker.app/p/<id>` endpoint instead of generating new direct old-Vercel links. The old rendering backend is retained for valid public/unlisted OG images.
- Existing third-party cached links/images cannot be revoked retroactively. Re-deploying, rewiring or shutting down the old Vercel project requires a separate service deployment/control-plane review; **not authorized or attempted** in this PR.
