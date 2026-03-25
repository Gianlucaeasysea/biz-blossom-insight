CREATE TABLE public.debug_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author text NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.debug_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read proposals"
  ON public.debug_proposals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert proposals"
  ON public.debug_proposals FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete proposals"
  ON public.debug_proposals FOR DELETE TO authenticated USING (true);