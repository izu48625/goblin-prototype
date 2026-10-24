# R72 — Stats Maker brand refresh & AdSense review readiness (2026-10-24)

## Goal
Move away from a monochrome dark-blue template aesthetic without changing ranking/score logic, publication privacy, Local-first storage, monetization state or Free-tier costs. The public discovery/landing interface should be visually led by **original Stats Maker exports and Public works**.

## Implemented design foundation
- JA/EN landing pages: warm off-white, editorial headlines, flat terracotta create CTA, minimally rounded cards, real R70 PNG gallery, readable original guides/FAQ still visible.
- Discover: neutral warm canvas, category-tinted existing **Public-snapshot-only score previews**, mobile-readable titles and filter controls. R71 Public-only safety and pagination unchanged.
- Editor and home shell: charcoal rather than blue-chrome, restrained terracotta action accents. Score heat-map semantics and rendered export templates are unchanged.
- Distinct CSS overrides to keep functionality and rollback easy; no remote font, tracker, image CDN, analytics or additional DB requests.
- Search and discovery are *not* repointed to user-generated images; permissions must not be weakened for better thumbnails.

## AdSense official-policy checklist
Source: https://support.google.com/adsense/answer/7299563 and https://support.google.com/adsense/answer/81904
- [x] Original explanatory material, hands-on scoring data, real exported sample PNGs: retain JA/EN example/guide pages.
- [x] Navigation: create / Discover / sample gallery / guide / Terms / Privacy / private contact.
- [x] Preserve detailed privacy policy in JA and EN, including Google third-party cookie disclosures for future ad activation.
- [x] Add owner ID verification meta tag to canonical JA/EN public landing pages in addition to root.
- [x] Place Google-authorized `ads.txt` record at root with the owner's registered publisher ID. Not mandatory for approval; highly recommended: https://support.google.com/adsense/answer/12171612
- [x] GA4 remains off, AdSense ad scripts absent, ad placement still opt-in preview-only.
- [ ] Manual: verify https://statsmaker.app/ads.txt responds as plain text; check Search Console / AdSense site status after deployment.
- [ ] Manual: recheck any specific AdSense rejection reason in dashboard before requesting another review.
- [ ] Review live mobile contrast, layout, navigation; run CI before merge, and deployed checks after merge.
- [ ] When ads begin, update policy from planned to actual behavior and confirm any required regional CMP/consent implementation.

## Next iterations (not claimed complete)
- R73: Template visual chooser for all 10 existing template types with locally generated and documented examples, preserving canonical editor workflows.
- R74: Public-only real preview exports with client-side capture / cache and strict visibility regression tests. Avoid network-heavy per-card OG rendering and stale visibility caching.
- R75: Brand mark/icon studies, independent real-phone QA of narrow screens, tested light/dark preference if users request it.
- R76: Repeat audits for broken links, policy readiness, mobile CWV and keyboard navigation.

## Risks & non-goals
- No claim that design changes guarantee Google approval; actual rejection details and review submission require owner account action.
- No speculative content padding, fake testimonials, scraped user images, additional behavioral tracking or paid services.
- Do not introduce ads before owner confirms approval and consent settings.
