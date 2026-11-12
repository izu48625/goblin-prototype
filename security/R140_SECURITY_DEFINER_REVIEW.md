# R140 — Stats Maker Supabase function exposure review

Audited 2026-11-12 against connected production project \`ibpdxbeltdwkquowjeay\`.
This is a privilege/behavior inventory, **not** a recommendation to revoke
all SECURITY DEFINER grants; PostgREST can legitimately expose intentionally
public aggregation functions. All public schemas keep RLS enabled.

## Current intentional public entrypoints (7 SECURITY DEFINER functions)

| Function | Why callable with anon key | Required guard / caution |
| --- | --- | --- |
| \`discover_public_participant_count_v1\` | Public Community participant badges | Reject non-public works and Community-disabled works |
| \`discover_public_rank_pair_v1\` | Public Discover ranking metadata | Return only public works; hide Community count if disabled |
| \`discover_public_remix_count_v1\` | Public Remix counts | Return only public works |
| \`get_community_criterion_summary\` | Public/URL-limited Community averages | Public or URL-limited and show_community; hide averages below minimum |
| \`get_community_item_summary\` | Public/URL-limited average scores | Same as above; require full item scoring |
| \`get_topic_participant_count\` | Community participant count | Public or URL-limited and show_community |
| \`topic_is_viewable\` | RLS lookup for public or direct URL-limited works | True only if owner or Public/Unlisted; not Private for others |

Anonymous sign-ins are an **intentional product design**. Postgres
\`authenticated\` includes anonymously signed-in Supabase users: it does not
mean a verified permanent account.

## Additional authenticated SECURITY DEFINER functions

The seven functions above may also be executed by \`authenticated\`. The other
three currently exposed to signed-in users are:

| Function | Purpose | Remaining hardening opportunity |
| --- | --- | --- |
| \`topic_is_owned_by_me\` | Owner-scoped RLS/validation | Uses auth.uid() equality; keep |
| \`topic_accepts_my_ratings\` | Enforce current author permission before saving ratings | **R140 fixed:** must require both allow_ratings and show_community |
| \`topic_has_submissions\` | Browser publication updates and structural-lock triggers | Returns a boolean for any supplied UUID; consider migrating browser caller to an owner-scoped RPC before revoking authenticated privilege |

The gateway-only \`save_my_topic_rating\` and
\`gateway_save_my_topic_rating\` functions are not directly executable using
anon or authenticated PostgREST roles; their runtime permissions and
Turnstile gateway must be retained.

## Current mitigation

- Applied on 2026-11-12: \`topic_accepts_my_ratings\` now checks
  \`show_community IS TRUE\` **as well as** \`allow_ratings IS TRUE\`.
- Verified that 5 existing public works remain joinable, unknown and private
  references are not joinable without owner identity.
- No user-owned works, votes, scores, labels, or visibility settings changed.
- Internal \`topic_has_submissions\`: anon EXECUTE remains disabled;
  authenticated EXECUTE remains **enabled on purpose** because
  \`base/js/app.js\` needs it during published-work update.
- Remaining Supabase advisor warnings (7 anon, 10 authenticated) should be
  risk-reviewed, not suppressed with blanket revokes.

## Future work, not applied

1. Create an owner-scoped replacement for
   \`topic_has_submissions\`, validate against all publication-update and
   trigger call paths, deploy the new client and keep a safe transition for
   browser tabs using older JavaScript before removing old EXECUTE.
2. Review the Community aggregation RPCs for information exposure where a
   known Unlisted work ID or response counts are involved.
3. Review Auth leaked-password protection only if email/password login is
   enabled; anonymous sign-in itself is required by Stats Maker.
4. Tackle unrelated Performance Advisor warnings (RLS initplans, duplicate
   index) after a verified rollback plan and query workload comparison.

Production SQL is documented in
\`security/R140_RATING_CONSENT_SERVER_GATE.sql\`.
