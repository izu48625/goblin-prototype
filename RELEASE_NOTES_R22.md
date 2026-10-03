# Stats Maker R22 Release Notes

## P1 Discover

### Public work discovery
- Added `discover.html` as a public browsing surface for Stats Maker works.
- Lists only topics whose visibility is exactly `public`.
- Unlisted works are intentionally excluded from Discover.
- Cards show:
  - title and description
  - target / metric counts
  - score scale
  - Community participant count
  - public Remix count
  - language
  - Remix / version lineage badge when applicable
  - updated date

### Search
- Client-side search covers:
  - title
  - description
  - target names
  - metric names

### Sorting
- Newest
- Popular: participant count + public Remix count
- Community: participant count
- Remix: public Remix count

### Navigation
- Added Discover entry to the main editor header.
- Added Discover entry to public pages and public-page footer.
- Discover cards open the existing public work page, preserving the Remix / Community flow.

### Performance / privacy
- Discover loads up to 60 current Public works for P1.
- Community participant counts reuse the privacy-safe R20 RPC.
- Participant counts may be shown below 5, but private averages remain unavailable.
- Participant RPC calls are batched to avoid a large request burst.
- No new Supabase migration is required for P1.

### Build
- Active cache key: `r22p1`.
