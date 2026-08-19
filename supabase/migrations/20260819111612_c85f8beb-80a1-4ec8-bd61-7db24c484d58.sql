CREATE TABLE public.ops_error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  route text NOT NULL,
  operation text NOT NULL,
  workspace_id uuid,
  request_id text,
  correlation_id text NOT NULL,
  provider text,
  code text NOT NULL,
  message text,
  severity text NOT NULL DEFAULT 'error',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON public.ops_error_events TO service_role;
ALTER TABLE public.ops_error_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX ops_error_events_created_idx ON public.ops_error_events (created_at DESC);
CREATE INDEX ops_error_events_corr_idx ON public.ops_error_events (correlation_id);

CREATE TABLE public.ops_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  workspace_id uuid NOT NULL,
  kind text NOT NULL,
  state text NOT NULL DEFAULT 'queued',
  correlation_id text NOT NULL,
  idempotency_key text,
  provider text,
  expected_ms integer NOT NULL DEFAULT 90000,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  code text,
  note text
);
GRANT ALL ON public.ops_jobs TO service_role;
ALTER TABLE public.ops_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX ops_jobs_state_idx ON public.ops_jobs (state, started_at);
CREATE INDEX ops_jobs_workspace_idx ON public.ops_jobs (workspace_id, created_at DESC);

CREATE TABLE public.ops_idempotency (
  key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  correlation_id text NOT NULL,
  job_id uuid,
  state text NOT NULL DEFAULT 'in_progress',
  note text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour'
);
GRANT ALL ON public.ops_idempotency TO service_role;
ALTER TABLE public.ops_idempotency ENABLE ROW LEVEL SECURITY;
CREATE INDEX ops_idempotency_expires_idx ON public.ops_idempotency (expires_at);