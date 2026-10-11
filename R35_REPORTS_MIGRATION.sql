-- R35 additive write-only work reports. Existing topics, ratings, privacy policies stay unchanged.
CREATE TABLE public.work_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL,
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL CHECK (reason IN ('spam','inappropriate','harassment','copyright','other')),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  moderator_note text NOT NULL DEFAULT '' CHECK (char_length(moderator_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT work_reports_other_details CHECK (reason <> 'other' OR char_length(btrim(details)) >= 8),
  CONSTRAINT work_reports_unique_reporter_topic UNIQUE (topic_id, reporter_id)
);
-- No cascading FK: owners can still delete works; moderation records are retained.
CREATE INDEX work_reports_queue_idx ON public.work_reports (status,created_at DESC);
ALTER TABLE public.work_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.work_reports FROM PUBLIC,anon,authenticated;
-- Public clients cannot read reports, supply reporter_id, or edit moderator status.
GRANT INSERT (topic_id,reason,details) ON public.work_reports TO authenticated;
CREATE POLICY work_reports_insert_public_other ON public.work_reports
FOR INSERT TO authenticated
WITH CHECK (
  reporter_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.id = topic_id AND t.visibility = 'public'
      AND t.owner_id <> (SELECT auth.uid())
  )
);
COMMENT ON TABLE public.work_reports IS 'R35 private moderation queue; authenticated Public-work insert only; no browser SELECT/UPDATE/DELETE.';