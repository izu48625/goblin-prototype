# Stats Maker R20 Release Notes

## P1 Community Core

### Community aggregation
- Community Overall Ranking is based on the average of each participant's fully scored target overall.
- Weighted topics respect the original criterion weights.
- Community metric averages summarize eligible Community score cells by metric.
- You vs Community comparison remains available for the current participant once privacy thresholds are met.

### Privacy threshold
- Fewer than 5 submitted participants:
  - participant count is visible,
  - Community averages are hidden,
  - Community ranking is hidden,
  - You vs Community differences are hidden.
- Even after the topic reaches 5 participants, each target/metric cell requires at least 5 eligible responses before its average is exposed.
- Frontend and database RPCs both enforce the threshold.

### Duplicate-vote protection
- One rating set per Supabase user/topic.
- Resubmitting updates the same rating instead of creating a second vote.
- Anonymous users remain supported through Supabase Anonymous Auth.

### Server-side validation
- Rating item/criterion IDs must belong to the source topic.
- Scores must be within the topic scale.
- Duplicate item/criterion pairs in one payload are rejected.
- Community submission requires every criterion to be completed for at least one target.

### Remix eligibility
- Community submission stays enabled only when target names/order, metric names/order, and score scale still match the original public work.
- Structural changes disable Community submission.

### Migration
Run once in Supabase SQL Editor:
- `R20_COMMUNITY_CORE_MIGRATION.sql`

### Build
- Active cache key: `r20p1`.
