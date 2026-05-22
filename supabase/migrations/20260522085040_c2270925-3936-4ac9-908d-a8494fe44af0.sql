
CREATE TABLE public.b2c_marketing_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'cross-sell',
  segment TEXT,
  boat_type TEXT,
  product_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  audience_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  audience_size INTEGER NOT NULL DEFAULT 0,
  discount_pct INTEGER NOT NULL DEFAULT 0,
  est_revenue_min NUMERIC NOT NULL DEFAULT 0,
  est_revenue_max NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2c_marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read campaigns"
  ON public.b2c_marketing_campaigns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert campaigns"
  ON public.b2c_marketing_campaigns FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated update campaigns"
  ON public.b2c_marketing_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated delete campaigns"
  ON public.b2c_marketing_campaigns FOR DELETE TO authenticated USING (true);

CREATE TRIGGER b2c_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.b2c_marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_b2c_marketing_campaigns_created_at ON public.b2c_marketing_campaigns(created_at DESC);
