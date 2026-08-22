CREATE TABLE public.motion_clip_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Motion Clip',
  status text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  provider_job_id text,
  idempotency_key text NOT NULL,
  source_path text,
  source_label text,
  source_kind text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  credits integer NOT NULL DEFAULT 0,
  charged boolean NOT NULL DEFAULT false,
  refunded boolean NOT NULL DEFAULT false,
  output_path text,
  thumbnail_path text,
  quality_check jsonb,
  error text,
  video_project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX motion_clip_jobs_idem ON public.motion_clip_jobs (user_id, idempotency_key);
CREATE INDEX motion_clip_jobs_user_created ON public.motion_clip_jobs (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motion_clip_jobs TO authenticated;
GRANT ALL ON public.motion_clip_jobs TO service_role;

ALTER TABLE public.motion_clip_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own motion clip jobs"
ON public.motion_clip_jobs FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER motion_clip_jobs_updated_at
BEFORE UPDATE ON public.motion_clip_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();