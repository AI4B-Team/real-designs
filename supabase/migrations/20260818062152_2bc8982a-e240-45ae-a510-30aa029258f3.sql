CREATE TABLE public.scene_start_end (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_project_id uuid NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  scene_key text NOT NULL,
  scene_id uuid REFERENCES public.video_scenes(id) ON DELETE SET NULL,
  start_asset_id uuid,
  end_asset_id uuid,
  start_path text NOT NULL,
  end_path text,
  start_crop text NOT NULL DEFAULT 'center',
  end_crop text NOT NULL DEFAULT 'center',
  transition_type text NOT NULL DEFAULT 'blend',
  transition_duration numeric NOT NULL DEFAULT 3,
  generation_mode text NOT NULL DEFAULT 'standard',
  provider_job_id text,
  clip_id uuid REFERENCES public.scene_clips(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'configured',
  credit_cost integer NOT NULL DEFAULT 0,
  disclosure text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_project_id, scene_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scene_start_end TO authenticated;
GRANT ALL ON public.scene_start_end TO service_role;

ALTER TABLE public.scene_start_end ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own scene start/end frames"
ON public.scene_start_end FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX scene_start_end_project_idx ON public.scene_start_end (video_project_id);

CREATE TRIGGER scene_start_end_updated_at
BEFORE UPDATE ON public.scene_start_end
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();