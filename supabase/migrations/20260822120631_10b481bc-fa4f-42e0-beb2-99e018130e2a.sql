-- 1) Share-link RPCs are only ever invoked server-side with the service role.
REVOKE EXECUTE ON FUNCTION public.add_presentation_comment(text, text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decide_presentation_share(text, text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_presentation_share(text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_presentation_share_view(text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_presentation_comment(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decide_presentation_share(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_presentation_share(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_presentation_share_view(text) TO service_role;

-- 2) Invitees may only answer an invite; they may never change who it belongs to or its role.
CREATE OR REPLACE FUNCTION public.lock_team_invite_grants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM OLD.owner_id THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR lower(NEW.email) IS DISTINCT FROM lower(OLD.email) THEN
      RAISE EXCEPTION 'Only the workspace owner can change an invite''s owner, email or role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_team_invite_grants ON public.team_invites;
CREATE TRIGGER lock_team_invite_grants
BEFORE UPDATE ON public.team_invites
FOR EACH ROW EXECUTE FUNCTION public.lock_team_invite_grants();