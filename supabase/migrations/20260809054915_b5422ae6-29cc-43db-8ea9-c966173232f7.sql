REVOKE EXECUTE ON FUNCTION public.founding_members_claimed() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.founding_members_claimed() TO service_role;