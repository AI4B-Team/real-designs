REVOKE ALL ON public.beta_allowlist FROM authenticated, anon;
REVOKE ALL ON public.ops_error_events FROM authenticated, anon;
REVOKE ALL ON public.ops_idempotency FROM authenticated, anon;
REVOKE ALL ON public.ops_jobs FROM authenticated, anon;
GRANT ALL ON public.beta_allowlist TO service_role;
GRANT ALL ON public.ops_error_events TO service_role;
GRANT ALL ON public.ops_idempotency TO service_role;
GRANT ALL ON public.ops_jobs TO service_role;