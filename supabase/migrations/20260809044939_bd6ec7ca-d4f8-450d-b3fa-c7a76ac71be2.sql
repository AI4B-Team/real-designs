DROP POLICY IF EXISTS "founding_members_count_public" ON public.founding_members;
REVOKE SELECT ON public.founding_members FROM anon;

CREATE OR REPLACE FUNCTION public.founding_members_claimed()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.founding_members;
$$;

GRANT EXECUTE ON FUNCTION public.founding_members_claimed() TO anon, authenticated, service_role;