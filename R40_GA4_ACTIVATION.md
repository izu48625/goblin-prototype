# CURRENT STATUS — R45 (2026-10-14)

**Owner requested GA4 to be paused.** Current source is `cloud/analytics-config.js` with `enabled:false` and `measurementId:''`: no GA4 banner or Google Analytics requests. The activation steps below are historical, not the current operating procedure. Account deletion is unnecessary. Future reactivation requires owner approval and privacy/consent review. AdSense remains separate and disabled.

---

# Stats Maker R40: GA4 opt-in activation

Updated 2026-10-14 · `izu48625/goblin-prototype` · `statsmaker.app`

- Owner authorized setup using measurement ID `G-ZT8N1BVEL8`. GA4 account, property and Web stream already existed. No new stream, paid feature or billing account was created.
- GA4 loads only after affirmative consent. Initial visit/decline: no Google GA4 library or telemetry is sent. Consent withdrawal stops future custom events. Japanese/English consent UI and link to privacy policy are provided.
- Existing allowlisted behavior events remain. Page groups cover Home, Discover, Public, Community, Editor, My Works and /ja/ and /en/ introductions; raw work titles, search text, scores, email, full topic IDs and private/unlisted links are omitted from custom events.
- **AdSense remains fully disabled**: no real ads, ad scripts, publisher ID, ads.txt or automatic advertising.
- Caveat: Google Enhanced Measurement can automatically collect other data once consent is granted. Owner should open GA4 Admin → Data streams → Web → Enhanced measurement and disable unneeded automatic site-search, form and page interaction features to minimize accidental collection of sensitive URL parameters or form values. Do not assume this setting was changed in the Google account.

## Owner's GA4 verification checklist

1. On a fresh private/incognito browser, visit `https://statsmaker.app/?analyticsDebug=1`. Decline tracking and check that no GA4 request is made. Start a second fresh session and choose Allow.
2. Open GA4 → Reports → Realtime and verify a visit appears within a few minutes (blocked browsers or extensions and reporting delay may affect results).
3. Navigate Home → Discover → a public work → Editor; verify safe page groups and custom events in Realtime/DebugView, with no private IDs or inputs.
4. Verify the consent settings action in the common navigation and test withdrawal. Check physical iPhone Safari display.
5. Optionally register event-scoped custom dimensions `page_group`, `template_type`, `filter_type`, `visibility`, `outcome`, `slot_id`. Avoid registering high-cardinality `work_code` unnecessarily.

Automated tests validate implementation invariants, not whether data arrived in the owner's Google account. No production works, ratings, or Supabase access rules changed.
