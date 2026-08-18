CREATE OR REPLACE FUNCTION public.storage_policy_report()
RETURNS TABLE (bucket text, cmd text, policyname text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT b.bucket,
         p.cmd::text,
         p.policyname::text
  FROM (VALUES ('room-photos'), ('reveal-videos'), ('user-audio')) AS b(bucket)
  LEFT JOIN pg_policies p
    ON p.schemaname = 'storage'
   AND p.tablename = 'objects'
   AND (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) LIKE '%' || b.bucket || '%'
$$;

REVOKE ALL ON FUNCTION public.storage_policy_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_policy_report() TO service_role;