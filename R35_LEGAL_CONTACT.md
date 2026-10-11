# R35 P2 — Legal pages and private contact operations

Implementation date: 2026-10-11. User-facing content is a **draft for operator/legal review**, not a legal compliance certification. No personal operator address or unverifiable email address is published.

## Entry points

- Japanese: https://statsmaker.app/ja/legal.html#terms, #privacy, #copyright, #contact
- English: https://statsmaker.app/en/legal.html#terms, #privacy, #copyright, #contact
- Bilingual links from /ja/, /en/, Discover and Public viewer footers. Legal pages have shared fixed HOME/Discover/JA/EN navigation.
- JA/EN changes on legal pages switch between their true localized routes, rather than reloading the wrong language.
- Contact form: question, copyright, appeal, and privacy request. Copyright/appeal need the affected statsmaker.app Public work URL. Rights, privacy and appeal messages require a reply email. No attachment upload; do not request ID documents.

## Privacy/security

- POST /api/report/contact is deployed through Cloudflare's already configured /api/report/* Worker-first route.
- Uses existing Supabase anonymous auth on submit; no Google/Apple login needed. Input is strictly validated, including message length, email and statsmaker.app work URL.
- Reuses REPORT_RATE_LIMIT with a dedicated "contact:" key prefix, so the contact API does not consume the work-report bucket. It provides **6 requests per source IP per minute**, not lifetime protection. Supabase Anonymous Auth and direct Data API remain potential abuse vectors.
- Database table public.contact_inquiries is new and isolated. Its **RLS is enabled** and ordinary anonymous/authenticated clients have no SELECT, UPDATE or DELETE; authenticated browser users may INSERT only category, reply_email, work_url and message. requester_id is server-filled with auth.uid(), reviewer fields are restricted.
- No service role secret, operator personal email, Supabase users, existing work/ratings, advertising or GA4 settings are modified. Real feedback submissions are not made by CI.
- Operators should review messages only through the privileged Supabase SQL Editor and redact/delete sensitive text as required. A sender cannot see message state publicly.

## Private operator inbox

Run in the project owner Supabase SQL Editor:

```sql
SELECT id,created_at,category,reply_email,work_url,message,status
FROM public.contact_inquiries
WHERE status IN ('open','reviewing')
ORDER BY created_at ASC LIMIT 100;
```

After review, use the privileged console to update **only the inquiry**:

```sql
UPDATE public.contact_inquiries
SET status='reviewing',reviewed_at=now(),moderator_note='Request being reviewed'
WHERE id = '<inquiry-id>' AND status='open';
```

Do **not** create an anonymous/public moderator dashboard. Manually confirm any action against a work or account; never delete on the basis of an unverified complaint alone.

## Rollout

1. Validate R35 P2 CI and the R30 restore QA test selector fix.
2. Apply R35_CONTACT_MIGRATION.sql once to Supabase before merging UI. Verify zero new messages, RLS, grants, and original work/rating totals.
3. Merge, check production pipeline separately, then test legal page loading, footer links and language switching without creating test personal data or fake complaints.
4. Check inbox regularly; operators **must set their own cadence**. The form creates a private queue, not email notifications or guaranteed response SLAs.
5. Owner/legal professional should review terms, operator identity details, applicable notices, jurisdiction, processing/retention practices, user rights, copyright procedure, service-provider disclosures, and policy effective dates **before public promotion**.

## R30 incident

2026-10-11 smoke build of 35cec812 failed at scripts/r30-home-corrupt-recovery-qa.mjs: the test clicked "More" and then Restore, which was hidden. "More" is a **toggle**. The QA now checks whether the tray is open before clicking and asserts its visibility; this prevents accidentally closing an already open tray. The corrected R30 browser recovery QA passed on main's 2026-10-11 production Smoke run. Keep the test and its assertions enabled to catch future regressions.

## Public copy accuracy audit (R35 P4–P5)

- The legal/contact form clearly distinguishes optional general-question email from required email for copyright, appeal and privacy requests. Copyright/appeal work URLs are required in both languages, matching frontend and backend validation.
- Removed internal legal-review status from the visitor-facing page; **this does not mean legal review is complete**. Keep legal review open as an operational task.
- Clarified that messages enter a private admin queue rather than triggering an automated email, and cautioned visitors not to send identity documents or passwords. Operator response capability and time have not been guaranteed.
- Before wider promotion, verify operator identity and address disclosure obligations under Japan APPI Article 32 and the appropriate lawful procedure for data access/correction/deletion. Real operator details must be provided by the site operator, not guessed or hard-coded.

## Follow-on

- The core user-facing policies and forms are implemented; keep them stable. Complete any legally required real operator identity/contact disclosures and review the retention policy in a separate operational step. Mail notification remains deferred unless explicitly requested.
- Better bot prevention for public submissions, user appeal operations, and private moderation interface.
- Defined verified deletion/retention operational policy (no promises about automatic deletion until implemented).
