CREATE TABLE public.video_render_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'browser',
  provider_job_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','rendering','completed','failed','cancelled')),
  progress NUMERIC NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
  stage TEXT,
  output_formats TEXT[] NOT NULL DEFAULT '{}',
  quality TEXT,
  scene_count INTEGER NOT NULL DEFAULT 0,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  heartbeat_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_render_jobs TO authenticated;
GRANT ALL ON public.video_render_jobs TO service_role;

ALTER TABLE public.video_render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own render jobs"
  ON public.video_render_jobs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- At most one live job per video: this is what stops duplicate renders and
-- duplicate credit charges.
CREATE UNIQUE INDEX video_render_jobs_one_active
  ON public.video_render_jobs (video_project_id)
  WHERE status IN ('queued','rendering');

CREATE INDEX video_render_jobs_user_status ON public.video_render_jobs (user_id, status);

CREATE TRIGGER update_video_render_jobs_updated_at
  BEFORE UPDATE ON public.video_render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();