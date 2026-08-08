CREATE TABLE public.founding_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'starter',
  claimed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.founding_members TO authenticated;
GRANT ALL ON public.founding_members TO service_role;
-- anon may count seats, but never read who claimed them
GRANT SELECT (id) ON public.founding_members TO anon;

ALTER TABLE public.founding_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY founding_members_count_public ON public.founding_members
  FOR SELECT TO anon USING (true);

CREATE POLICY founding_members_read_own ON public.founding_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY founding_members_claim_own ON public.founding_members
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND (SELECT count(*) FROM public.founding_members) < 500
  );