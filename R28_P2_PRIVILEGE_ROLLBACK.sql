-- R28 Phase 2 rollback: only restore the three original extras.
-- Use ONLY if a legitimate app operation requires legacy privileges.
-- Neither rows nor RLS, basic DML, or RPC grants are affected.
alter function public.set_updated_at() reset search_path;
grant truncate, trigger, references
  on table
    public.topics,
    public.criteria,
    public.topic_items,
    public.rating_sets,
    public.scores
  to anon, authenticated;
