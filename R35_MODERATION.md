# R35 Public Work Reporting — Operations & Security

Status: implementation in the `r35-public-work-report-safety` PR. Apply database migration before turning on the UI in production. Existing topics, scoring, visibility, anonymized participant ratings and GA4 configuration are unchanged.

## Behavior

- Only works currently marked **Public** expose the unobtrusive `Report this work` button on `public.html?id=<uuid>` to non-owners. Unlisted and Private are excluded in the interface **and** in the database RLS rule.
- The visitor can select Spam, Inappropriate content, Harassment, Copyright/rights or Other. Other requires >=8 characters. Details are limited to 500 characters. The original work is not modified.
- Existing Supabase session is reused. For visitors without one, Supabase Anonymous Sign-In is used only on submission. No Google/Apple login is required.
- Worker `/api/report/work` requires same-origin POST, a user JWT, strict reason/topic/details validation and an isolated Cloudflare Free rate limiter (6 reports / IP / minute). Database verifies the JWT and ownership through RLS.
- The database also blocks a second report by the same account for the same work using a UNIQUE constraint. Reports are never exposed by SELECT policies or a public moderation dashboard. Credentials for privileged database access are not needed by the Worker.
- These protections are **basic abuse controls**: determined abusers can create fresh anonymous sessions or send direct requests to the Supabase Data API. Add a stronger trusted write gateway, CAPTCHA and controlled moderator authentication if volume requires it; do not claim these protections are airtight.

## Queue review (owner-only: Supabase SQL Editor)

```sql
SELECT r.id, r.created_at, r.topic_id, t.title, r.reason, r.details, r.status
FROM public.work_reports r
LEFT JOIN public.topics t ON t.id = r.topic_id
WHERE r.status IN ('open', 'reviewing')
ORDER BY r.created_at ASC LIMIT 100;
```

Manually inspect the work and evidence, then use the SQL Editor as the trusted operator to update **only the report**:

```sql
UPDATE public.work_reports
SET status = 'reviewing', reviewed_at = now(), moderator_note = 'Investigating'
WHERE id = '<reviewed-report-uuid>' AND status = 'open';
```

When resolved or dismissed, manually change only the report status and note. **Never automatically delete or hide a topic based on a report alone.** Any work moderation decision requires explicit owner action and a separately reviewed authorization/appeal process.

## Deploy and review checklist

1. PR CI: worker error paths, no public SELECT/UPDATE/DELETE, UI copy, bilingual modal, iPhone width, syntax/build, existing publish/R34 privacy checks.
2. Before production merge: apply `R35_REPORTS_MIGRATION.sql` through the connected Supabase migration tool and verify table schema, RLS, privileges, UNIQUE and policy. No test reports in production.
3. Merge only after CI and migration verification. Production Cloudflare Workers deployment may be managed outside GitHub, so verify Worker deploy separately instead of assuming a GitHub merge deploys automatically.
4. Manually test a report only using an isolated staging project or explicit owner-approved test work. Never submit false reports against real Public content.

## Remaining R35 tasks

- Written Terms of Service, Privacy Policy, copyright takedown/contact procedure and appeal procedure.
- Private authenticated moderator interface, triage audit trail, and stronger bot prevention, subject to actual abuse and owner confirmation.
- Community rating spam detection separate from this work-report feature; preserve current Turnstile gateway and rating constraints.