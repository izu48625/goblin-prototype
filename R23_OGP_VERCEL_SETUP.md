# Stats Maker R23 P3 — Vercel OGP Setup

## Goal
Keep the main Stats Maker app on GitHub Pages while using Vercel only for dynamic social previews.

Shared URL flow:

```
https://<vercel-domain>/p/<topic-id>
        ↓
Vercel Function reads the public / unlisted topic from Supabase
        ↓
Returns per-work og:title / og:description / og:image
        ↓
Human browser is redirected to:
https://izu48625.github.io/goblin-prototype/public.html?id=<topic-id>
```

OG image endpoint:

```
https://<vercel-domain>/api/og?id=<topic-id>
```

The image is generated as a 1200×630 PNG with:
- Stats Maker branding
- category
- work title
- description
- target count
- metric count
- score scale
- creator Overall TOP 3

## Files
- `api/share.js` — crawler-facing HTML / OG metadata
- `api/og.js` — dynamic 1200×630 PNG
- `server/og-data.js` — Supabase read + ranking calculation
- `vercel.json` — `/p/:id` rewrite
- `package.json` — `@vercel/og` + React
- `robots.txt` — allows OG image crawling
- `cloud/runtime-config.js` — GitHub Pages → Vercel share origin switch

## Vercel project
Deploy this repository root as a Vercel project.

No application migration is required. GitHub Pages remains the canonical app.

Optional environment variables:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `STATS_MAKER_APP_ORIGIN`

The checked-in defaults use the existing public Supabase URL / publishable key and the GitHub Pages app origin. Do not use a Supabase service-role key.

## Activate URL sharing
After the Vercel project has a stable production URL, update:

`cloud/runtime-config.js`

From:

```js
ogShareOrigin:''
```

To:

```js
ogShareOrigin:'https://<vercel-domain>'
```

Until this value is set, the existing GitHub Pages URL sharing remains unchanged.

## Verification
Use a real Public or Unlisted topic ID.

1. Open:
   `https://<vercel-domain>/api/og?id=<topic-id>`
   - Expected: 1200×630 PNG.

2. View source:
   `https://<vercel-domain>/p/<topic-id>`
   - Expected:
     - work-specific `og:title`
     - work-specific `og:description`
     - absolute `og:image`
     - `twitter:card=summary_large_image`

3. Open the share URL in a normal browser.
   - Expected: redirect to the existing GitHub Pages public work.

4. Test the URL in Vercel Open Graph preview and target social platforms.

## Privacy
- Private topics are not intentionally exposed.
- The OGP reader requests only Public / Unlisted topics.
- Community averages are not queried or rendered, so the R20 five-participant privacy threshold is not involved.
