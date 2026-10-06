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

## UX1 Mobile editor cleanup

### Mobile header
- Reduced the top action row to:
  - Discover
  - Publish
  - New
  - overflow menu
- Duplicate and Delete moved into the overflow menu on mobile.
- Desktop keeps the existing direct buttons.
- Tightened title, description, saved-sheet controls, spacing, and header padding.

### Community join
- The long eligibility explanation is no longer always expanded on mobile.
- Added a compact “Conditions / 参加条件” disclosure.
- Join CTA remains immediately visible.
- Desktop keeps the full explanation.

### Sheet controls
- View-mode tabs are shorter and visually quieter.
- Add Row / Add Metric / Metric Management / Scoring / More use a single horizontally scrollable tool rail on mobile.
- Search + grade filter + result count stay on one compact row.

### Visual Tools launcher
- Replaced the large full-width mobile launcher with a compact right-aligned pill.
- Reduced the reserved footer rail from 82px to 56px plus safe-area space.
- Mobile subtitle is hidden while the main label and plus icon remain visible.

### Build
- Active cache key: `r23ux1`.
- No database migration required.

## UX2 Full-width mobile launcher

- Restored the mobile Visual Tools launcher to full width.
- Kept the newer compact height and reduced footer reserve from UX1.
- Other mobile editor cleanup from UX1 remains unchanged.
- Active root cache key: `r23ux2`.

## UX3 Language & Discover density

### Visual Tools launcher
- Full-width mobile launcher remains.
- Launcher label is centered across the button rather than left aligned.
- Plus icon stays at the left edge without shifting the label.

### Language
- Removed JA / EN controls from the Visual Tools sheet.
- Moved JA / EN switching to the home editor beside Saved Sheets.
- Home language changes are sent to the outer launcher so Visual Tools labels stay synchronized.

### Discover density
- Public work cards now prioritize title, description, category and update date.
- Creator TOP3, participant count, Remix count, target count, metric count and scale are collapsed under “スタッツを見る / Show stats”.
- Stats expand only for the selected post.
- Mobile card spacing, hero, category rail, search controls and sort controls are tightened so more posts fit on screen.

### Build
- Active cache key: `r23ux3`.
- No database migration required.

## UX4 Editable Fit View

### Direct editing in Fit View
- Fit View is no longer read-only.
- Target names can be edited directly.
- Metric names can be edited directly.
- Score cells can be edited directly with numeric input.
- 10-point sheets retain decimal input support.

### Live behavior
- Score changes update the current row average immediately.
- Heat coloring updates while typing.
- Committed edits synchronize to:
  - normal table
  - overview
  - ranking / compare / summary
  - Community eligibility state
- Score values are clamped to the active scale on commit.
- Enter advances to the next score cell when available.

### iPhone / Safari
- Fit inputs use a 16px computed font on mobile before parent scaling to avoid Safari focus zoom.
- Focused cells receive a clear highlight.
- Native number spinners are hidden for a cleaner compact grid.

### Build
- Active cache key: `r23ux4`.
- No database migration required.

## UX5 Table view default

- Saved sheets now always open in the normal Table view when Stats Maker launches.
- Previous Fit / Overview choice no longer becomes the next-launch default.
- Users can still switch freely to Overview or Fit View during the current session.
- Editable Fit View from UX4 remains fully available.
- Active cache key: `r23ux5`.

## P3A Dynamic OGP infrastructure

### Server-rendered share entry
- Added a Vercel-only `/p/:id` route.
- The route reads the matching Public / Unlisted topic from Supabase on the server.
- It returns work-specific:
  - `og:title`
  - `og:description`
  - `og:url`
  - `og:image`
  - Twitter large-card metadata.
- Human browsers are redirected back to the existing GitHub Pages public work.

### Dynamic OG image
- Added `/api/og?id=...`.
- Generates a native 1200×630 PNG with `@vercel/og`.
- Includes category, title, description, target count, metric count, score scale, and creator Overall TOP 3.
- Community averages are not included, so the Community privacy threshold is never bypassed.
- CDN cache headers are included.

### Safe activation
- Added `cloud/runtime-config.js`.
- `ogShareOrigin` is intentionally blank until the production Vercel domain is known.
- Public URL sharing falls back to the existing GitHub Pages URL while blank.
- Once the Vercel domain is configured, URL Share and the URL attached to native image shares use `/p/:id`.

### Hosting
- Main app remains on GitHub Pages.
- Vercel is used only for the dynamic OGP/share-entry layer.
- No Supabase migration required.

### Build
- Active cache key: `r23p3a`.
