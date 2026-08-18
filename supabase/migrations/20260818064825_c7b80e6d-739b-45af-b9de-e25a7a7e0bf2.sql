CREATE TABLE IF NOT EXISTS public.video_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_project_id uuid NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  -- Stable scene keys identify the connection; scene ids are filled in once the
  -- scenes exist as rows. A transition is never addressed by array index.
  from_key text NOT NULL,
  to_key text NOT NULL,
  from_scene_id uuid REFERENCES public.video_scenes(id) ON DELETE CASCADE,
  to_scene_id uuid REFERENCES public.video_scenes(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'auto',
  duration_ms integer NOT NULL DEFAULT 600,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_clip_path text,
  generation_job_id uuid,
  provider text,
  provider_job_id text,
  status text NOT NULL DEFAULT 'configured',
  progress numeric NOT NULL DEFAULT 0,
  credits_reserved integer NOT NULL DEFAULT 0,
  credits_charged integer NOT NULL DEFAULT 0,
  credits_released integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_transitions TO authenticated;
GRANT ALL ON public.video_transitions TO service_role;

ALTER TABLE public.video_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own transitions"
  ON public.video_transitions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS video_transitions_unique_conn
  ON public.video_transitions (video_project_id, from_key, to_key);

CREATE UNIQUE INDEX IF NOT EXISTS video_transitions_unique_scene_conn
  ON public.video_transitions (video_project_id, from_scene_id, to_scene_id)
  WHERE from_scene_id IS NOT NULL AND to_scene_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS video_transitions_project_idx
  ON public.video_transitions (video_project_id);

CREATE TRIGGER video_transitions_updated_at
  BEFORE UPDATE ON public.video_transitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();