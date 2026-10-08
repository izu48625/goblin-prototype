# Stats Maker — Cloudflare Migration

## Goal

Move the public Stats Maker app from GitHub Pages to Cloudflare Workers while keeping GitHub as the source repository and Supabase as the database/auth backend.

Target public domain:

- `https://statsmaker.app/`
- Public work: `https://statsmaker.app/public.html?id=<topic-id>`
- Share / OGP entry: `https://statsmaker.app/p/<topic-id>`

## Stage 1 architecture

- GitHub: source of truth
- Cloudflare Workers + Static Assets: app hosting and `/p/*` share routes
- Supabase: database + anonymous identity + Community
- Vercel: temporary PNG OGP renderer only, proxied behind `https://statsmaker.app/api/og`

The Vercel hostname is no longer exposed in newly generated share URLs on Cloudflare.

## Cloudflare setup

1. Create / sign in to a Cloudflare account.
2. Go to **Domain Registration > Register Domains**.
3. Search for `statsmaker.app`.
4. If available, purchase it and verify the registrant email.
5. Go to **Workers & Pages > Create application**.
6. Choose **Import a repository**.
7. Connect GitHub and allow access to `izu48625/goblin-prototype`.
8. Select that repository.
9. Worker name must be exactly:
   `stats-maker`
10. Production branch:
   `main`
11. Build command:
   `npm run build:cloudflare`
12. Deploy command:
   `npx wrangler deploy`
13. Save and deploy.

The repository contains `wrangler.jsonc`, so Workers Builds should use it.

## First QA on workers.dev

Before connecting the custom domain, verify:

- `/` loads the editor
- `/discover.html` loads Discover
- `/public.html?id=<known-topic-id>` loads a public work
- `/rate.html?id=<known-topic-id>` can create/use an anonymous session
- `/api/health` returns `ok: true`
- `/p/<known-topic-id>` returns work-specific OG metadata and redirects to the public page
- `/api/og?id=<known-topic-id>` returns a 1200×630 PNG

## Custom domain

After workers.dev QA passes:

1. Open the `stats-maker` Worker.
2. Go to **Settings > Domains & Routes**.
3. Add Custom Domain:
   `statsmaker.app`
4. Optionally add:
   `www.statsmaker.app`
   and redirect it to the apex domain later.
5. Wait for SSL to become active.

Cloudflare Registrar uses Cloudflare nameservers automatically, so no external DNS provider setup is required when the domain is purchased directly from Cloudflare.

## Supabase

Anonymous-first R24 P3 means Google/Apple OAuth is not required.

After the custom domain is live, no Auth redirect setup is required for normal create/publish/Community usage.

The browser-facing app continues using the existing publishable Supabase key. Never expose a secret/service-role key.

## Stage 2 — remove Vercel

Stage 1 deliberately keeps the proven Sharp-based PNG renderer on Vercel behind the Cloudflare proxy.

Before monetization, replace the `/api/og` proxy with a Cloudflare-native renderer, then remove the Vercel deployment.

This can be done without changing public share URLs because users already share:

`https://statsmaker.app/p/<topic-id>`

and OG images already resolve through:

`https://statsmaker.app/api/og?id=<topic-id>`

## Rollback

GitHub Pages remains live during migration:

`https://izu48625.github.io/goblin-prototype/`

Do not disable it until Cloudflare, Community, PNG export and OGP have passed production QA.
