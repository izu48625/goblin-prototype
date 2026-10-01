# Stats Maker R19 Release Notes

## P1 Publish / Public Page Polish

- Refreshed the public Stats Maker page into a more complete work page with:
  - visibility badge
  - updated date
  - creator #1 summary
  - target / metric / score-scale summary cards
  - creator score table
  - creator ranking
  - weighted metric chips
  - Community section
- Public and Unlisted semantics are now clearer:
  - Public is treated as a public work and is eligible for future listing/search surfaces.
  - Unlisted stays out of public listing/search surfaces and is accessible to people with the URL.
- When the current browser session owns the public work, the page shows an “Edit / Publish settings” action.
  - If the local source sheet still exists, Stats Maker selects it again.
  - Publish settings reopen automatically after returning.
- Publish UI now treats private/unpublished topics correctly:
  - Unpublish controls are hidden when already private.
  - Republish returns to the normal publish action state.
- Public-page sharing has a clipboard fallback when the native share sheet is unavailable.
- Public URLs now carry the active R19 cache key.
- Fixed stale R18 cache references in the main editor/public entry points and the old Remix redirect.
- No database migration is required.
- Active cache key: r19p1.

## P2 Ranking labels
- Renamed creator-facing ranking labels for clarity:
  - 作成者1位 → あなたの総合1位
  - 作成者ランキング → あなたの総合ランキング
  - Community Ranking → Community総合ランキング
- English labels updated to “Your Overall #1”, “Your Overall Ranking”, and “Community Overall Ranking”.
- Active cache key: r19p2.
