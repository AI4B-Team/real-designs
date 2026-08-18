-- Level 3 AI clips: one durable row per generated clip job.
CREATE TABLE IF NOT EXISTS public.scene_clips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  video_project_id UUID REFERENCES public.video_projects(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.video_scenes(id) ON DELETE SET NULL,
  source_path TEXT,
  animate_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 8,
  size TEXT NOT NULL DEFAULT '1280x720',
  provider TEXT NOT NULL DEFAULT 'veo',
  provider_job_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  progress NUMERIC NOT NULL DEFAULT 0,
  storage_path TEXT,
  disclosure TEXT,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  credits_refunded INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scene_clips_user_idx ON public.scene_clips(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scene_clips_project_idx ON public.scene_clips(video_project_id);
CREATE UNIQUE INDEX IF NOT EXISTS scene_clips_active_scene_idx
  ON public.scene_clips(scene_id) WHERE status IN ('queued','processing');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scene_clips TO authenticated;
GRANT ALL ON public.scene_clips TO service_role;
ALTER TABLE public.scene_clips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own scene clips" ON public.scene_clips;
CREATE POLICY "Users manage their own scene clips" ON public.scene_clips
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS scene_clips_updated_at ON public.scene_clips;
CREATE TRIGGER scene_clips_updated_at BEFORE UPDATE ON public.scene_clips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Scene-level enhancement columns (Levels 1-3 stored durably).
ALTER TABLE public.video_scenes
  ADD COLUMN IF NOT EXISTS enhancement_level TEXT NOT NULL DEFAULT 'motion',
  ADD COLUMN IF NOT EXISTS look TEXT,
  ADD COLUMN IF NOT EXISTS effect_id TEXT,
  ADD COLUMN IF NOT EXISTS effect_intensity NUMERIC NOT NULL DEFAULT 0.6,
  ADD COLUMN IF NOT EXISTS animate_id TEXT,
  ADD COLUMN IF NOT EXISTS clip_id UUID REFERENCES public.scene_clips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS use_clip BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_path TEXT,
  ADD COLUMN IF NOT EXISTS disclosures JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Project-level modification log for disclosure exports.
ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS modification_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS template_id TEXT;