-- R35 P2: private, insert-only inquiries. Does not modify existing user data, reports or scoring.
CREATE TABLE public.contact_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL DEFAULT auth.uid(),
  category text NOT NULL CHECK (category IN ('general','copyright','appeal','privacy')),
  reply_email text NOT NULL DEFAULT '' CHECK (char_length(reply_email) <= 254),
  work_url text NOT NULL DEFAULT '' CHECK (char_length(work_url) <= 500),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 20 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  moderator_note text NOT NULL DEFAULT '' CHECK (char_length(moderator_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT contact_inquiries_reply_required CHECK (category = 'general' OR char_length(btrim(reply_email)) > 0),
  CONSTRAINT contact_inquiries_target_required CHECK (category NOT IN ('copyright','appeal') OR char_length(btrim(work_url)) > 0)
);
CREATE INDEX contact_inquiries_queue_idx ON public.contact_inquiries(status,created_at DESC);
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_inquiries FROM PUBLIC, anon, authenticated;
GRANT INSERT (category,reply_email,work_url,message) ON public.contact_inquiries TO authenticated;
CREATE POLICY contact_inquiries_insert_own ON public.contact_inquiries
FOR INSERT TO authenticated WITH CHECK (requester_id = (SELECT auth.uid()));
COMMENT ON TABLE public.contact_inquiries IS 'Private R35 contact/rights/appeal queue; no anonymous or authenticated SELECT, UPDATE or DELETE.';
