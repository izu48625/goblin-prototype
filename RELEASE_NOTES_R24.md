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
