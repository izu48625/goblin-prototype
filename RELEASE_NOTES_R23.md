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
- Active cache key: `r23p1`.
- No Supabase migration required.
