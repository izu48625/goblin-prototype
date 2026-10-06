# Stats Maker R23 P3 — Vercel OGP

## Production architecture

Stats Maker itself remains on GitHub Pages.

Vercel is used only for the per-work social-preview layer:

```
Stats Maker public work
        ↓ URL Share
https://stats-maker-ogp.vercel.app/p/<topic-id>
        ↓
server-rendered work-specific OGP metadata
        ↓
human browser → GitHub Pages public.html?id=<topic-id>
social crawler → /api/og?id=<topic-id>
```

## Production endpoints

Share entry:

```
https://stats-maker-ogp.vercel.app/p/<topic-id>
```

Dynamic OG PNG:

```
https://stats-maker-ogp.vercel.app/api/og?id=<topic-id>
```

The PNG is exactly 1200×630 and includes:
- Stats Maker branding
- category
- work title
- description
- target count
- metric count
- score scale
- creator Overall TOP 3

## Final implementation

- `api/share.mjs` — crawler-facing HTML and work-specific OGP metadata
- `api/og.js` — Node function that builds an SVG and renders it to PNG with Sharp
- `server/og-data.mjs` — Supabase read and creator ranking calculation
- `vercel.json` — rewrites `/p/:id` to the share function
- `package.json` — Node 22 + `sharp`
- `cloud/runtime-config.js` — production Vercel share origin
- `.github/workflows/ogp-smoke.yml` — live production regression test

The earlier `@vercel/og` renderer was removed after production diagnostics found a Vercel bundling/runtime failure involving its Node `fs` dependency. The final renderer uses Sharp instead.

## Privacy

- Only Public / Unlisted topics can be read by the OGP layer.
- Private topics are not rendered.
- Community aggregate data is never queried for OGP images.
- The R20 Community five-participant privacy threshold is therefore not bypassed.
- Only the Supabase publishable key is used. Never use a service-role key.

## Automatic verification

On relevant pushes to `main`, GitHub Actions:

1. waits for the exact commit's Vercel deployment to finish;
2. fetches a real Public Stats Maker work from Supabase;
3. checks work-specific `og:title`, `og:description`, `og:image` and Twitter large-card metadata;
4. checks the GitHub Pages public-work destination;
5. downloads the production OG image;
6. verifies it is a PNG;
7. verifies dimensions are exactly 1200×630.

R23 P3 is considered production-ready only when this workflow passes.
