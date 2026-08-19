CREATE TABLE public.beta_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.beta_allowlist TO service_role;
ALTER TABLE public.beta_allowlist ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS page text,
  ADD COLUMN IF NOT EXISTS workflow text,
  ADD COLUMN IF NOT EXISTS diagnostic_id text;

CREATE INDEX IF NOT EXISTS feedback_diagnostic_id_idx ON public.feedback (diagnostic_id);