# Stats Maker R24 — Accounts / My Page

## P1 — Account & My Page Foundation

### My Page
- Added `my.html` as the account / cloud-work management surface.
- Shows three explicit states:
  - signed out
  - anonymous guest
  - permanent account
- Lists up to 200 works owned by the current Supabase user, including Public, Unlisted and Private works.
- Adds work counters and visibility filtering.
- Allows changing a work between Public / Unlisted / Private.
- Public and Unlisted works can be opened and their TRUE OGP share URL copied.

### Guest → permanent account safety
- Anonymous publishing remains supported.
- Google / Apple account actions use Supabase identity linking while a guest session exists.
- This keeps the same Supabase user ID instead of signing the anonymous user out first.
- Existing `owner_id` ownership therefore remains attached to the same user after a successful link.
- Signed-out users use normal OAuth sign-in.

### OAuth prerequisites
Google / Apple buttons require the corresponding Supabase Auth provider to be configured.
Manual identity linking must also be enabled for guest → permanent upgrades.
The GitHub Pages My Page URL must be allowed as an Auth redirect URL.

### Database
- No migration required for P1.
- Existing owner RLS (`owner_id = auth.uid()`) is reused.
- No service-role key is used.

### Local-first
- Creating and editing sheets still requires no login.
- My Page only manages cloud-published works.
- Local browser data is not uploaded automatically.

### Mobile
- My Page is responsive and optimized for iPhone Safari.
- Account actions and work cards collapse to a single-column layout on narrow screens.

### Build
- Active application cache key: `r24p1`.


## P2 — OAuth Readiness & Ownership QA

### Provider readiness
- My Page now reads Supabase's public Auth settings endpoint at runtime.
- Google and Apple are shown as enabled / not configured instead of failing only after a tap.
- Provider buttons are disabled when the corresponding provider is known to be unavailable.

### Guest ownership continuity
- OAuth linking stores the pre-auth anonymous user ID before leaving Stats Maker.
- After the OAuth return, My Page verifies:
  - the same Supabase user ID is still active;
  - the selected provider is actually linked;
  - the account is no longer anonymous.
- A successful check confirms that existing `owner_id` data remains attached to the same user.
- If the user ID changes, My Page displays an explicit ownership safety warning and does not assume any guest work was transferred.

### Anonymous sign-out safety
- Sign Out is hidden for anonymous users.
- This prevents an unrecoverable guest session from being discarded before it has a permanent identity.

### Identity source
- Linked identities are refreshed with `auth.getUserIdentities()` instead of relying only on the session's cached user object.

### OAuth return handling
- Provider linking uses the production My Page URL as `redirectTo`.
- Auth state refresh is deferred outside the auth callback before making more Supabase calls.
- Pending OAuth state is persisted before the browser redirect and expires automatically.
- OAuth callback errors are surfaced in My Page and never treated as a successful ownership transfer.
- Legacy hidden email/password actions can no longer sign an anonymous owner out; account conversion is routed through My Page.

### Setup
- Added `R24_AUTH_SETUP.md` with the exact Stats Maker, My Page, Supabase callback, Google origin, Google redirect, and Apple web OAuth values.
- Provider secrets remain outside GitHub and browser code.

### Build
- Active application cache key: `r24p2`.


## P3 — Anonymous-first Release Cleanup

### Product direction
- Formal release no longer requires a visible account or login.
- Core flow is now: create → publish / share → join Community → compare with Community.
- Google / Apple identity linking is parked as an optional future backup / multi-device feature.

### Editor / publish UI
- Removed desktop and mobile My Page entry points from the editor.
- Removed the legacy email/password sign-up, sign-in and sign-out UI from the publish dialog.
- Publish now enters the settings screen directly and silently creates an anonymous Supabase identity only when cloud identity is needed.
- Existing permanent sessions remain compatible, but no account UI is exposed.
- Publish copy now explains that the anonymous ID is browser-local and that clearing browser data may remove update ownership.

### Community
- Community participation remains fully available without account registration.
- The rating page silently starts an anonymous session when needed.
- The existing database uniqueness rule on `rating_sets(topic_id, user_id)` remains the source of truth for one participant per work.
- Re-submission from the same anonymous identity updates the existing rating rather than adding another vote.
- Creator/community comparison remains unchanged.

### Parked account surface
- `my.html` is no longer linked from the product and is marked `noindex,nofollow`.
- R24 P1/P2 account code is preserved for a possible future optional sync / recovery feature.
- Google / Apple OAuth configuration is not required for the anonymous-first release.

### Build
- Active application cache key: `r24p3`.
- No database migration is required.


## P4 — Cloudflare Stage 1

### Hosting
- Added Cloudflare Workers + Static Assets deployment configuration.
- Added a deterministic production bundle builder that copies only public app files to `dist/`.
- Added Workers Builds npm scripts and pinned Wrangler.
- GitHub remains the source of truth.

### Share URLs
- Cloudflare deployments use same-origin `/p/<topic-id>` share URLs.
- Added a Worker share route with work-specific OG/Twitter metadata.
- Added `/api/health` for deployment QA.

### OGP transition
- Stage 1 proxies `/api/og` to the existing proven Vercel Sharp renderer.
- The Vercel hostname is hidden from new Cloudflare share URLs.
- Stage 2 will replace the renderer with a Cloudflare-native implementation before monetization.

### Safety
- GitHub Pages remains live as rollback during migration.
- Supabase remains unchanged.
- No secret/service-role key is added.
- No database migration required.

### Build
- Active cache key: `r24p4`.

### Worker name sync
- Cloudflare production Worker name is `stats-maker-web`.
- `wrangler.jsonc` is aligned with the Worker created in Cloudflare Dashboard.
