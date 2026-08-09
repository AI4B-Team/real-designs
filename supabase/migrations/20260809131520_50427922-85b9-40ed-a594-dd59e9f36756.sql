DROP POLICY IF EXISTS "Invited users can accept their invite" ON public.team_invites;
CREATE POLICY "Invited users can answer their invite"
ON public.team_invites FOR UPDATE TO authenticated
USING (lower(email) = lower(COALESCE((auth.jwt() ->> 'email'), '')) AND status = 'pending')
WITH CHECK (
  lower(email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
  AND (
    (status = 'accepted' AND accepted_user_id = auth.uid())
    OR (status = 'declined')
  )
);

DROP POLICY IF EXISTS "Owners manage their invites" ON public.team_invites;
CREATE POLICY "Owners manage their invites"
ON public.team_invites FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (
  auth.uid() = owner_id
  AND role = ANY (ARRAY['member','admin'])
  AND status = ANY (ARRAY['pending','accepted','revoked','declined'])
);