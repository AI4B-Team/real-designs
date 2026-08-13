CREATE TABLE public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan plan_tier NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  period_start timestamptz,
  period_end timestamptz,
  next_refill_on date,
  last_refill_on date,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription readable" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.plan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_plan plan_tier NOT NULL,
  current_plan plan_tier NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE UNIQUE INDEX plan_requests_one_pending ON public.plan_requests (user_id) WHERE status = 'pending';
GRANT SELECT ON public.plan_requests TO authenticated;
GRANT ALL ON public.plan_requests TO service_role;
ALTER TABLE public.plan_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plan requests readable" ON public.plan_requests FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  detail text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_events_user_created ON public.billing_events (user_id, created_at DESC);
GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own billing events readable" ON public.billing_events FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.plan_monthly_credits(_plan plan_tier)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE _plan WHEN 'starter' THEN 200 WHEN 'pro' THEN 2000 WHEN 'studio' THEN 4000 ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.plan_rank(_plan plan_tier)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE _plan WHEN 'free' THEN 0 WHEN 'starter' THEN 1 WHEN 'pro' THEN 2 ELSE 3 END;
$$;

CREATE OR REPLACE FUNCTION public.sync_subscription()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); s public.subscriptions; acct public.credit_accounts; guard int := 0; amt int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.ensure_credit_account(uid);
  INSERT INTO public.subscriptions (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO s FROM public.subscriptions WHERE user_id = uid FOR UPDATE;

  IF s.plan <> 'free' AND s.period_end IS NOT NULL AND s.period_end <= now() THEN
    IF s.cancel_at_period_end THEN
      UPDATE public.subscriptions
         SET plan = 'free', status = 'canceled', cancel_at_period_end = false,
             period_start = NULL, period_end = NULL, next_refill_on = NULL
       WHERE user_id = uid RETURNING * INTO s;
      UPDATE public.credit_accounts SET plan = 'free' WHERE user_id = uid;
      INSERT INTO public.billing_events (user_id, kind, detail) VALUES (uid, 'canceled', 'Subscription ended and the account moved to Free');
    ELSE
      UPDATE public.subscriptions SET status = 'past_due' WHERE user_id = uid RETURNING * INTO s;
      INSERT INTO public.billing_events (user_id, kind, detail) VALUES (uid, 'past_due', 'Renewal is due and no payment method is on file');
    END IF;
  END IF;

  IF s.plan <> 'free' AND s.status = 'active' THEN
    WHILE s.next_refill_on IS NOT NULL AND s.next_refill_on <= CURRENT_DATE AND guard < 24 LOOP
      guard := guard + 1;
      amt := public.plan_monthly_credits(s.plan);
      IF amt > 0 THEN
        PERFORM public.grant_credits(uid, amt, 'grant', 'Monthly credit refill');
      END IF;
      UPDATE public.subscriptions
         SET last_refill_on = s.next_refill_on,
             next_refill_on = (s.next_refill_on + interval '1 month')::date
       WHERE user_id = uid RETURNING * INTO s;
      INSERT INTO public.billing_events (user_id, kind, detail, meta)
      VALUES (uid, 'refill', 'Monthly credits added', jsonb_build_object('amount', amt));
    END LOOP;
  END IF;

  SELECT * INTO acct FROM public.credit_accounts WHERE user_id = uid;

  RETURN jsonb_build_object(
    'plan', s.plan, 'status', s.status,
    'cancel_at_period_end', s.cancel_at_period_end,
    'period_start', s.period_start, 'period_end', s.period_end,
    'next_refill_on', s.next_refill_on,
    'monthly_credits', public.plan_monthly_credits(s.plan),
    'balance', acct.balance,
    'pending_request', (
      SELECT jsonb_build_object('id', pr.id, 'plan', pr.requested_plan, 'created_at', pr.created_at)
      FROM public.plan_requests pr WHERE pr.user_id = uid AND pr.status = 'pending'
      ORDER BY pr.created_at DESC LIMIT 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_plan_change(_plan plan_tier)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); cur plan_tier;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.sync_subscription();
  SELECT plan INTO cur FROM public.credit_accounts WHERE user_id = uid;

  IF _plan = cur THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'same_plan');
  END IF;

  IF public.plan_rank(_plan) > public.plan_rank(cur) THEN
    UPDATE public.plan_requests SET status = 'superseded', decided_at = now()
     WHERE user_id = uid AND status = 'pending';
    INSERT INTO public.plan_requests (user_id, requested_plan, current_plan)
    VALUES (uid, _plan, cur);
    INSERT INTO public.billing_events (user_id, kind, detail, meta)
    VALUES (uid, 'requested', 'Requested the ' || initcap(_plan::text) || ' plan', jsonb_build_object('plan', _plan));
    RETURN jsonb_build_object('ok', true, 'pending', true, 'plan', _plan);
  END IF;

  UPDATE public.credit_accounts SET plan = _plan WHERE user_id = uid;
  UPDATE public.subscriptions
     SET plan = _plan,
         status = CASE WHEN _plan = 'free' THEN 'canceled' ELSE 'active' END,
         cancel_at_period_end = false,
         period_start = CASE WHEN _plan = 'free' THEN NULL ELSE now() END,
         period_end = CASE WHEN _plan = 'free' THEN NULL ELSE now() + interval '1 year' END,
         next_refill_on = CASE WHEN _plan = 'free' THEN NULL ELSE (CURRENT_DATE + interval '1 month')::date END
   WHERE user_id = uid;
  UPDATE public.plan_requests SET status = 'superseded', decided_at = now()
   WHERE user_id = uid AND status = 'pending';
  INSERT INTO public.billing_events (user_id, kind, detail, meta)
  VALUES (uid, CASE WHEN _plan = 'free' THEN 'canceled' ELSE 'downgraded' END,
          'Moved to the ' || initcap(_plan::text) || ' plan', jsonb_build_object('plan', _plan));
  RETURN jsonb_build_object('ok', true, 'pending', false, 'plan', _plan);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_subscription_cancel(_cancel boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); s public.subscriptions;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.sync_subscription();
  SELECT * INTO s FROM public.subscriptions WHERE user_id = uid;
  IF s.plan = 'free' THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_subscription'); END IF;
  UPDATE public.subscriptions SET cancel_at_period_end = _cancel WHERE user_id = uid;
  INSERT INTO public.billing_events (user_id, kind, detail)
  VALUES (uid, CASE WHEN _cancel THEN 'cancel_scheduled' ELSE 'cancel_reverted' END,
          CASE WHEN _cancel THEN 'Cancellation scheduled for the end of the term' ELSE 'Cancellation reverted, the plan renews as normal' END);
  RETURN jsonb_build_object('ok', true, 'cancel_at_period_end', _cancel);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_plan_request()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.plan_requests SET status = 'withdrawn', decided_at = now()
   WHERE user_id = uid AND status = 'pending';
  INSERT INTO public.billing_events (user_id, kind, detail) VALUES (uid, 'request_withdrawn', 'Plan request withdrawn');
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_plan_request(_user_id uuid, _plan plan_tier)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE amt int := public.plan_monthly_credits(_plan);
BEGIN
  PERFORM public.ensure_credit_account(_user_id);
  INSERT INTO public.subscriptions (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.credit_accounts SET plan = _plan WHERE user_id = _user_id;
  UPDATE public.subscriptions
     SET plan = _plan, status = 'active', cancel_at_period_end = false,
         period_start = now(), period_end = now() + interval '1 year',
         next_refill_on = (CURRENT_DATE + interval '1 month')::date, last_refill_on = CURRENT_DATE
   WHERE user_id = _user_id;
  UPDATE public.plan_requests SET status = 'activated', decided_at = now()
   WHERE user_id = _user_id AND status = 'pending';
  IF amt > 0 THEN PERFORM public.grant_credits(_user_id, amt, 'grant', 'Plan activation credits'); END IF;
  INSERT INTO public.billing_events (user_id, kind, detail, meta)
  VALUES (_user_id, 'activated', 'The ' || initcap(_plan::text) || ' plan is active', jsonb_build_object('plan', _plan, 'credits', amt));
  RETURN jsonb_build_object('ok', true, 'plan', _plan);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_subscription() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_plan_change(plan_tier) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_subscription_cancel(boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_plan_request() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.activate_plan_request(uuid, plan_tier) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_subscription() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_plan_change(plan_tier) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_subscription_cancel(boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_plan_request() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_plan_request(uuid, plan_tier) TO service_role;
GRANT EXECUTE ON FUNCTION public.plan_monthly_credits(plan_tier) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_rank(plan_tier) TO authenticated, service_role;