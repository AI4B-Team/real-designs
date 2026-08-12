-- Lock down SECURITY DEFINER functions: revoke direct API execute rights.

-- Trigger-only functions: never called directly.
REVOKE ALL ON FUNCTION public.enforce_founding_cap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Credit engine: only ever invoked by the service-role server client.
REVOKE ALL ON FUNCTION public.ensure_credit_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_credits(uuid, integer, public.credit_action, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spend_credits(uuid, public.credit_action, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_credit_account(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, public.credit_action, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, public.credit_action, text) TO service_role;

-- Share-link surface: routed exclusively through trusted server functions.
REVOKE ALL ON FUNCTION public.get_shared_presentation(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_presentation_view(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.respond_to_presentation(text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.founding_members_claimed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_presentation(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_presentation_view(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_presentation(text, text, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.founding_members_claimed() TO service_role;

-- Owner action performed as the signed-in user; keeps its internal ownership check.
REVOKE ALL ON FUNCTION public.record_presentation_reminder(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_presentation_reminder(uuid) TO authenticated, service_role;

-- Used inside RLS policies, so authenticated must retain execute rights.
REVOKE ALL ON FUNCTION public.has_workspace_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_access(uuid) TO authenticated, service_role;