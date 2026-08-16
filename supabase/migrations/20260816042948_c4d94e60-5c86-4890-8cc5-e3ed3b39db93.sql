ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.market_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  region text not null,
  email text,
  note text,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT ON public.market_requests TO authenticated;
GRANT ALL ON public.market_requests TO service_role;

ALTER TABLE public.market_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own market requests select" ON public.market_requests;
CREATE POLICY "own market requests select" ON public.market_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own market requests insert" ON public.market_requests;
CREATE POLICY "own market requests insert" ON public.market_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS market_requests_region_idx ON public.market_requests (region);