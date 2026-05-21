CREATE TABLE public.b2c_customer_insights (
  customer_id TEXT PRIMARY KEY,
  customer_name TEXT,
  customer_email TEXT,
  boat_type TEXT,
  boat_size_range TEXT,
  owner_profile TEXT,
  confidence NUMERIC,
  cross_sell_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_order_count INT NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2c_customer_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read insights"
ON public.b2c_customer_insights FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert insights"
ON public.b2c_customer_insights FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated update insights"
ON public.b2c_customer_insights FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated delete insights"
ON public.b2c_customer_insights FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_b2c_customer_insights_updated_at
BEFORE UPDATE ON public.b2c_customer_insights
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();