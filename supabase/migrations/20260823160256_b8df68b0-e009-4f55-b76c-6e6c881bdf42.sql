CREATE OR REPLACE FUNCTION public.restore_free_design(_user_id uuid, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct public.credit_accounts;
BEGIN
  PERFORM public.ensure_credit_account(_user_id);
  UPDATE public.credit_accounts
     SET free_used_today = GREATEST(free_used_today - 1, 0)
   WHERE user_id = _user_id
  RETURNING * INTO acct;

  INSERT INTO public.credit_ledger (user_id, action, delta, balance_after, note)
  VALUES (_user_id, 'refund', 0, acct.balance, COALESCE(_note, 'free daily design restored'));

  RETURN jsonb_build_object('ok', true, 'remaining_today', GREATEST(5 - acct.free_used_today, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.restore_free_design(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_free_design(uuid, text) TO service_role;