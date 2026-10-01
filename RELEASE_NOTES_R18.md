# Stats Maker R18 Complete Candidate C4

Build: `R18-COMPLETE-C4`

## Base sheet
- Metric names are now edited inline in the table header.
- Removed the browser `prompt()` flow for metric renaming.
- Enter / blur commits the name; Escape restores the previous name.
- Blank metric names restore the previous/default label.
- Existing row/metric instant-delete behavior remains.

## Publish
- Added an independent publish-button guard so the Publish dialog opens even if auth refresh fails.
- Publish errors are surfaced in the dialog instead of failing silently.
- Unified active cache key to `r18c1`.

## Visual runtime
- Active launcher/editor now run directly from the editable ES-module source tree instead of the stale production bundle.
- Existing runtime bundle remains in the repository only for compatibility.

## Scatter
- Auto Zoom is now the default.
- Full Scale mode remains available.
- Auto range respects 0–100 or 0–10 and minimum widths of 20 / 2.
- Added numeric X/Y ticks.
- Added average lines with AVG values.
- Added collision-aware label placement and leader lines.
- Long labels can use two lines.
- Enlarged plot area.
- Missing scores are not converted to zero.
- iPhone native PNG renderer uses the same Auto/Full range rules and collision-aware labels.

## Cloud
Existing R18 Public Viewer, Remix, anonymous Community rating and privacy threshold remain.

## Supabase
The existing `R18_SUPABASE_MIGRATION.sql` is still required once.
Anonymous Sign-Ins must be enabled for Community rating.

## C2 hotfix
- Fixed editor parse failure (`Unexpected reserved word`) caused by `await` inside non-async `forEach` callbacks in Quadrant and Ranking Card source modules.
- Added hard inline Publish dialog fallback on the Publish button itself.
- Cache/build key bumped to `r18c2`.
- All active source modules passed syntax validation after the fix.

## C4 guest publish
- Publish no longer requires email/password registration.
- When no Supabase session exists, Stats Maker starts an anonymous authenticated session automatically.
- Guest creators can publish, update, and make their own pages private while the anonymous session remains on the device.
- Added owner-scoped RLS policies for anonymous creators.
- Added `R18_C4_GUEST_PUBLISH_MIGRATION.sql` for existing Supabase projects.
- The UI warns that clearing browser data may remove control of guest-published pages.


## C6 Remix / Community / visual limits
- Public pages now show Remix + Share as the primary actions. The old "Rate this" entry was removed.
- Remix now opens a blank personal scoring copy instead of copying the creator's scores.
- Remixed sheets keep source Community metadata and show a Community participation panel in the normal Stats Maker screen.
- Community submission is allowed only while target names/order, metric names/order, and scoring scale match the original public sheet.
- A visible warning explains that adding/removing/changing the original structure disables Community submission.
- Users can either publish their own remixed sheet or submit their rating to the original Community from the same scoring screen.
- Base limits remain 40 targets / 10 metrics.
- Visual safety limits:
  - Ranking Card: default 10, max 20
  - Bar: default 10, max 20
  - Dot: default 10, max 20
  - Range/Dumbbell: default 10, max 20
  - Scatter/Quadrant: all points may render up to the sheet limit; labels default to 15 and can be 10/15/20/all
  - Radar: max 6 targets and 10 metrics
  - Tier List: all 40 targets supported
  - Stat Card: up to the sheet's 10 metrics
  - Ring Gauge: up to all 10 metrics
- Empty metric scores stay missing instead of becoming zero in linked metric/range visuals.
- Active cache key: r18c6.


## C7 Visual selection / XY highlights
- Limited source-linked visuals now let users choose the exact target names to display instead of always taking the first items.
- Ranking Card / Bar / Dot: named target picker, up to 20 targets.
- Range / Dumbbell: named target picker, up to 20 targets.
- Radar: named target picker remains capped at 6, now with bulk-select/clear controls.
- Target picker shows Select All when all rows fit the visual limit; otherwise it offers a quick "first N" action plus individual target selection.
- Quadrant / Scatter now include a per-target highlight picker with an individual color control for each selected point.
- Highlighted Quadrant / Scatter points are larger, outlined, and keep their labels visible even when the normal label limit is lower.
- PNG/native export preserves Quadrant / Scatter highlight colors and highlighted labels.
- Existing axis/metric selectors remain available for Quadrant, Scatter, Range, and metric-driven visuals.
- No database migration is required.
- Active cache key: r18c7.
