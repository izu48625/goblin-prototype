# Stats Maker R23 Release Notes

## P1 Social Visuals

### Public share image
- Public work pages now include a dedicated “Share Image / 画像で共有” action.
- Generates a native 1200×630 PNG suited to social sharing.
- The generated card includes:
  - Stats Maker branding
  - work title and description
  - category
  - creator Overall Top 3
  - target count
  - metric count
  - score scale
- iPhone / supported browsers use the native file share sheet.
- If file sharing is unavailable or fails, the PNG is saved locally instead.
- Existing URL Share remains available separately.

### Discover visual thumbnails
- Discover cards now include a compact visual Top 3 preview generated from the creator’s published scores.
- The preview respects:
  - score scale
  - weighted / unweighted averages
  - published snapshot data
- Works without scored data show a neutral Stats Maker placeholder.

### OGP note
- GitHub Pages serves `public.html?id=...` as one static HTML document.
- Reliable per-work social crawler OGP cannot be guaranteed from client-side JavaScript alone.
- Dynamic per-work OGP is intentionally deferred to a later R23 step using an edge/server rendering layer or generated per-work HTML.

### Build
- P1 cache key: `r23p1`.
- No Supabase migration required.

## P2 Share Templates

### Aspect ratios
Public share images can now be generated in:
- 16:9 — 1200×675
- 1:1 — 1080×1080
- 4:5 — 1080×1350

### Templates
Users can choose:
- Creator TOP3
- Community TOP3
- Overview card

Community TOP3 is enabled only when the existing R20 privacy threshold is satisfied and an eligible Community ranking is available.

### Shared metadata
All layouts include Stats Maker branding and category context.
The share system now also incorporates:
- target count
- metric count
- score scale
- Community participant count

Square, landscape, and portrait layouts are independently arranged to avoid overlap.

### Mobile / Safari
- “Share Image” now opens a bottom-sheet style chooser on small screens.
- Native file sharing remains the preferred path on iPhone/Safari.
- PNG download remains the fallback when file sharing is unavailable.
- Long titles use responsive font sizing and multi-line truncation.

### Discover polish
- Visual thumbnails now receive category-specific atmosphere styling so cards are easier to distinguish at a glance.

### Build
- Active cache key: `r23p2`.
- No Supabase migration required.
