# Stats Maker R25 — Production Clean

## P1 — First-run cleanup & production smoke

### First-run experience
- Removed the One Piece sample sheet from the default first launch.
- Fresh browsers now start with a blank sheet.
- Existing local libraries are preserved unchanged.
- Removed development-facing `V1.0-A2.1 · i18n Polish` branding from the active editor shell.

### Production release
- Active release/cache key: `r25p1`.
- Cloudflare health endpoint reports `r25p1`.
- Custom domain remains `https://statsmaker.app/`.

### Automated production QA
Added a GitHub Actions production smoke workflow that waits for the matching Cloudflare release and then validates:

- home page
- Discover
- public work page
- Community rating page shell
- same-origin `/p/<topic-id>` share metadata
- same-origin `/api/og` image endpoint
- 1200×630 PNG OGP output
- fresh-browser blank first run
- no visible My Page / login UI
- Discover public cards load
- public Community summary loads
- Remix returns to the editor
- Community participation action is present after Remix

The browser smoke is read-only with respect to Community data; it does not submit a production rating.


## P2 — Remix Context Fix

- Fixed the Remix source-context panel not rendering on the editor's initial load after a Remix.
- `renderRemixContext()` now runs with the normal header render path, alongside Community participation state.
- Remix save/redirect/localStorage behavior was already working; this fixes the missing initial UI context.
- Active release/cache key: `r25p2`.


## P3 — Community Feedback & Fresh Home

- Community participant counting was verified against production data: submitted rating sets and `get_topic_participant_count` agree.
- Re-submitting from the same anonymous user updates the existing vote and does not increase the participant count.
- The Community rating page now shows the current participant count and refreshes it immediately after a successful submission.
- Public pages reload when restored from browser BFCache so a just-submitted participant count is not left stale after navigating back.
- Added an explicit HOME action to Public, Discover, and Community rating pages.
- HOME opens a brand-new blank sheet while preserving all existing locally saved sheets.
- Active release/cache key: `r25p3`.
- Production smoke now verifies fresh HOME navigation and preservation of existing local sheets.
