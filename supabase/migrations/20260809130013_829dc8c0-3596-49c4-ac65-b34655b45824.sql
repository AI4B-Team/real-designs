CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending',
  accepted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX team_invites_owner_email_idx ON public.team_invites (owner_id, lower(email));
CREATE INDEX team_invites_email_idx ON public.team_invites (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites TO authenticated;
GRANT ALL ON public.team_invites TO service_role;

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their invites"
ON public.team_invites FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id AND role IN ('member','admin') AND status IN ('pending','accepted','revoked'));

CREATE POLICY "Invited users can see invites sent to their email"
ON public.team_invites FOR SELECT TO authenticated
USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

CREATE POLICY "Invited users can accept their invite"
ON public.team_invites FOR UPDATE TO authenticated
USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')) AND status = 'pending')
WITH CHECK (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')) AND status = 'accepted' AND accepted_user_id = auth.uid());