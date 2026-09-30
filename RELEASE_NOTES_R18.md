# Stats Maker R18 Complete Candidate C1

Build: `R18-COMPLETE-C1`

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
