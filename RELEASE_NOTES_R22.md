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

## P2 Community browser + categories

### Community works tab
- Discover now has two top-level browsing modes:
  - Public works
  - Community works
- Community works only includes Public topics with both ratings and Community enabled.
- Existing search and sorting remain available inside both modes.

### Categories
Publishing now supports one category per work:
- Sports
- Manga / Anime
- Movies / TV
- Food
- Games
- Music
- Books
- Travel / Places
- Technology
- Lifestyle / Hobbies
- Other

- Categories are stored in the existing publish snapshot JSON, so no new database column is required.
- Existing published works without category metadata fall back to Other.
- Discover shows the category on each card and supports category filtering.
- Category filtering is available in both Public and Community browsing.

### Privacy / listing behavior
- Discover remains strictly Public-only.
- Unlisted works are never included in either tab.
- Community participant counts use the existing R20 aggregate RPC.
- No new Supabase migration required.

### Build
- Active cache key: `r22p2`.

## P3 Partial search

- Discover search now uses normalized partial matching instead of requiring the query to appear as one exact phrase.
- Full-width / half-width forms are normalized with NFKC.
- Search remains case-insensitive.
- Common separators such as ・ / , _ - are normalized to spaces.
- Multiple space-separated search terms use AND matching:
  - each term may match any part of the searchable work text,
  - terms may be found across title, description, target names, metric names, or category.
- Example: `ワンピ 映画` can match a work whose searchable content contains both partial terms even when they are not adjacent.
- Active cache key: `r22p3`.
