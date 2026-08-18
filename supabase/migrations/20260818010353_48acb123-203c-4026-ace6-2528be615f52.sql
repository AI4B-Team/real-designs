CREATE TABLE IF NOT EXISTS public.project_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_type text NOT NULL CHECK (project_type IN ('photo_staging','photo_redesign','property_video')),
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  property_address text,
  title text,
  status text NOT NULL DEFAULT 'draft',
  builder_step text,
  video_project_id uuid REFERENCES public.video_projects(id) ON DELETE SET NULL,
  assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected jsonb NOT NULL DEFAULT '[]'::jsonb,
  item_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  rooms jsonb NOT NULL DEFAULT '{}'::jsonb,
  crop jsonb NOT NULL DEFAULT '{}'::jsonb,
  motion jsonb NOT NULL DEFAULT '{}'::jsonb,
  effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  titles jsonb NOT NULL DEFAULT '{}'::jsonb,
  audio jsonb NOT NULL DEFAULT '{}'::jsonb,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  video_format text,
  quality text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_opened_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_drafts TO authenticated;
GRANT ALL ON public.project_drafts TO service_role;

ALTER TABLE public.project_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own project drafts" ON public.project_drafts;
CREATE POLICY "Users manage their own project drafts"
  ON public.project_drafts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS project_drafts_user_updated_idx ON public.project_drafts (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS project_drafts_property_idx ON public.project_drafts (property_id);
CREATE INDEX IF NOT EXISTS project_drafts_type_idx ON public.project_drafts (user_id, project_type, status);

DROP TRIGGER IF EXISTS project_drafts_updated_at ON public.project_drafts;
CREATE TRIGGER project_drafts_updated_at
  BEFORE UPDATE ON public.project_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS builder_step text;
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS last_opened_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.video_projects ADD COLUMN IF NOT EXISTS draft_state jsonb NOT NULL DEFAULT '{}'::jsonb;