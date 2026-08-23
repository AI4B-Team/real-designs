ALTER TABLE public.ops_idempotency
  ADD COLUMN IF NOT EXISTS result jsonb,
  ADD COLUMN IF NOT EXISTS credit_state text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS charged integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS action text;

CREATE INDEX IF NOT EXISTS ops_idempotency_user_idx ON public.ops_idempotency (user_id, created_at DESC);
GRANT ALL ON public.ops_idempotency TO service_role;