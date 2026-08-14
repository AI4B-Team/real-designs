-- 1. Reference pricing data: server-only
DROP POLICY IF EXISTS "Anyone can read markets" ON public.markets;
DROP POLICY IF EXISTS "Anyone can read unit_costs" ON public.unit_costs;
DROP POLICY IF EXISTS "Anyone can read cost_mappings" ON public.cost_mappings;

REVOKE SELECT ON public.markets FROM anon;
REVOKE SELECT ON public.unit_costs FROM anon;
REVOKE SELECT ON public.cost_mappings FROM anon;
GRANT ALL ON public.markets TO service_role;
GRANT ALL ON public.unit_costs TO service_role;
GRANT ALL ON public.cost_mappings TO service_role;

CREATE POLICY "Signed-in users can read markets"
  ON public.markets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can read unit costs"
  ON public.unit_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can read cost mappings"
  ON public.cost_mappings FOR SELECT TO authenticated USING (true);

-- 2. Style configuration: signed-in only
DROP POLICY IF EXISTS "Anyone can read style overrides" ON public.style_overrides;
DROP POLICY IF EXISTS "Public can read style overrides" ON public.style_overrides;
REVOKE SELECT ON public.style_overrides FROM anon;
GRANT ALL ON public.style_overrides TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'style_overrides'
      AND cmd = 'SELECT' AND 'authenticated' = ANY (roles)
  ) THEN
    CREATE POLICY "Signed-in users can read style overrides"
      ON public.style_overrides FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 3. Visitor video feedback: writes only through the trusted server routine
DROP POLICY IF EXISTS "No direct inserts on video feedback" ON public.video_presentation_feedback;
CREATE POLICY "No direct inserts on video feedback"
  ON public.video_presentation_feedback FOR INSERT TO authenticated, anon WITH CHECK (false);
GRANT ALL ON public.video_presentation_feedback TO service_role;