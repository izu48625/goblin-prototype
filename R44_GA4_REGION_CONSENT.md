# R44 | GA4 location-aware initial consent (2026-10-14)

## Decision / scope
Owner requested that Stats Maker users in Japan should **not see an initial analytics consent banner**, while users outside Japan should explicitly opt in. Some regions cannot be tested physically by the owner; this release therefore includes isolated browser simulations on Chromium **and WebKit** for JP, EEA, UK, Switzerland, US, unknown, malformed/error responses, and JP→overseas changes.

## Trusted geography
- Cloudflare Worker `/api/analytics-region` uses **only** `request.cf.country==='JP'` to return `{"mode":"jp"}`. All other/missing locations return `{"mode":"consent_required"}`.
- The API does not return IP address or exact country; no personal data is saved for geolocation.
- The response is private/no-store. The Worker must run first for that route, even with static assets.
- **Never** trust language, query parameters, `CF-IPCountry` client-provided request headers or browser timezone to make a JP determination.
- Network error, timeout, unexpected JSON or off-Cloudflare hosting uses the consent-required mode (safe failure).

## Behavior
- JP: GA4 starts after the trustworthy country check and without a first-visit prompt; the privacy notice is published; visitors can opt out through Help → 解析設定. JP default tracking is **not saved as consent**.
- All other/unknown: explicit opt-in is required before any Google tag loads; refusal means no GA4 tag. Previously stored affirmative consent (from v1) is **not grandfathered**, because consent policy changed. Old stored refusal is preserved.
- Revoke from the Help menu: record refusal and reload to unload any existing GA4 script.
- HOME in-page iframe relies on outer page analytics bridge. Graph editor doesn't show unsolicited consent prompt that would obstruct sticky export controls; consent controls remain in Help if relevant.
- No AdSense tag, ads.txt, publisher registration, paid product, or Supabase data is changed.

## Legality and limits
- This is a Japan-first UX strategy, **not a legal opinion**. Confirm the Japanese external transmission disclosure and relevant privacy rules for the actual operator, and verify consent and CMP requirements in other jurisdictions before enabling advertising. IP-based country estimation can be wrong (VPN, network proxy).
- Using a consent prompt for all non-JP territories is conservative, and the banner is not a full certified AdSense CMP. A Google-certified CMP must be reviewed separately before ads run in EEA/UK/CH.
- Browser tests mock location and Google tag requests; they do **not** prove physical overseas geolocation or actual Google Analytics reporting.

## Test and owner verification
- `node scripts/r44-analytics-region-qa.mjs`: mocked Cloudflare country requests, forged header/query safety, cache/no-store and route integration.
- `BASE_URL=http://127.0.0.1:8765 node scripts/r44-analytics-region-browser-qa.mjs`: both Chromium and WebKit, complete consent/opt-out flows, 320px mobile, travel case, network failures.
- After deployment: Japan incognito visit to `https://statsmaker.app/`, confirm *no prompt* and GA4 Realtime data; click Help → 解析設定 → 拒否する and verify Google stops on reload. CI simulates the overseas consent flow; owner need not use a VPN to test.
