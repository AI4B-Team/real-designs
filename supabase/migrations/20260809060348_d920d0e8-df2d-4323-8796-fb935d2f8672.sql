-- Plans and action costs live in the database so the app and the UI can't drift.
CREATE TYPE public.plan_tier AS ENUM ('free', 'starter', 'pro', 'studio');
CREATE TYPE public.credit_action AS ENUM ('design', 'scope', 'plan_3d', 'video', 'topup', 'grant', 'refund');

CREATE TABLE public.credit_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.plan_tier NOT NULL DEFAULT 'free',
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  free_used_today integer NOT NULL DEFAULT 0 CHECK (free_used_today >= 0),
  free_day date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credit_accounts TO authenticated;
GRANT ALL ON public.credit_accounts TO service_role;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_accounts_read_own ON public.credit_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action public.credit_action NOT NULL,
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credit_ledger_user_idx ON public.credit_ledger (user_id, created_at DESC);

GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_ledger_read_own ON public.credit_ledger
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_credit_accounts_updated_at
BEFORE UPDATE ON public.credit_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cost table, single source of truth.
CREATE OR REPLACE FUNCTION public.credit_cost(_action public.credit_action)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _action
    WHEN 'design' THEN 1
    WHEN 'scope' THEN 3
    WHEN 'plan_3d' THEN 6
    WHEN 'video' THEN 40
    ELSE 0
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.credit_cost(public.credit_action) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_cost(public.credit_action) TO service_role;

-- Ensure an account row exists for a signed-in user.
CREATE OR REPLACE FUNCTION public.ensure_credit_account(_user_id uuid)
RETURNS public.credit_accounts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acct public.credit_accounts;
BEGIN
  INSERT INTO public.credit_accounts (user_id) VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.credit_accounts
     SET free_used_today = 0, free_day = CURRENT_DATE
   WHERE user_id = _user_id AND free_day <> CURRENT_DATE;

  SELECT * INTO acct FROM public.credit_accounts WHERE user_id = _user_id;
  RETURN acct;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_credit_account(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_credit_account(uuid) TO service_role;

-- Atomically charge for an action. Free plan uses a 5/day allowance instead of balance.
CREATE OR REPLACE FUNCTION public.spend_credits(_user_id uuid, _action public.credit_action, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acct public.credit_accounts;
  cost integer;
BEGIN
  PERFORM public.ensure_credit_account(_user_id);
  cost := public.credit_cost(_action);

  SELECT * INTO acct FROM public.credit_accounts WHERE user_id = _user_id FOR UPDATE;

  IF acct.plan = 'free' THEN
    IF _action <> 'design' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'plan_required', 'cost', cost, 'balance', acct.balance);
    END IF;
    IF acct.free_used_today >= 5 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'daily_limit', 'cost', cost, 'remaining_today', 0);
    END IF;
    UPDATE public.credit_accounts
       SET free_used_today = free_used_today + 1
     WHERE user_id = _user_id
    RETURNING * INTO acct;

    INSERT INTO public.credit_ledger (user_id, action, delta, balance_after, note)
    VALUES (_user_id, _action, 0, acct.balance, COALESCE(_note, 'free daily allowance'));

    RETURN jsonb_build_object('ok', true, 'charged', 0, 'balance', acct.balance,
                              'remaining_today', 5 - acct.free_used_today);
  END IF;

  IF acct.balance < cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_credits', 'cost', cost, 'balance', acct.balance);
  END IF;

  UPDATE public.credit_accounts SET balance = balance - cost
   WHERE user_id = _user_id RETURNING * INTO acct;

  INSERT INTO public.credit_ledger (user_id, action, delta, balance_after, note)
  VALUES (_user_id, _action, -cost, acct.balance, _note);

  RETURN jsonb_build_object('ok', true, 'charged', cost, 'balance', acct.balance);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.spend_credits(uuid, public.credit_action, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, public.credit_action, text) TO service_role;

-- Add credits (top-up pack, plan renewal, manual grant, refund).
CREATE OR REPLACE FUNCTION public.grant_credits(_user_id uuid, _amount integer, _action public.credit_action DEFAULT 'grant', _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acct public.credit_accounts;
BEGIN
  IF _amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;
  PERFORM public.ensure_credit_account(_user_id);
  UPDATE public.credit_accounts SET balance = balance + _amount
   WHERE user_id = _user_id RETURNING * INTO acct;
  INSERT INTO public.credit_ledger (user_id, action, delta, balance_after, note)
  VALUES (_user_id, _action, _amount, acct.balance, _note);
  RETURN jsonb_build_object('ok', true, 'balance', acct.balance);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, integer, public.credit_action, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, public.credit_action, text) TO service_role;