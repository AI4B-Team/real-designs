ALTER TABLE public.video_scenes
  ADD COLUMN IF NOT EXISTS motion_level text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS immersive_effect text,
  ADD COLUMN IF NOT EXISTS exterior_effect text,
  ADD COLUMN IF NOT EXISTS labels jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.video_share_links
  ADD COLUMN IF NOT EXISTS presentation_type text NOT NULL DEFAULT 'listing',
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS page_title text,
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mobile_layout text NOT NULL DEFAULT 'stacked',
  ADD COLUMN IF NOT EXISTS approval_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS video_share_links_slug_key ON public.video_share_links (slug) WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.video_presentation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_link_id uuid NOT NULL REFERENCES public.video_share_links(id) ON DELETE CASCADE,
  visitor_name text,
  visitor_email text,
  kind text NOT NULL DEFAULT 'comment',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.video_presentation_feedback TO authenticated;
GRANT ALL ON public.video_presentation_feedback TO service_role;
ALTER TABLE public.video_presentation_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own presentation feedback" ON public.video_presentation_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete own presentation feedback" ON public.video_presentation_feedback
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS video_presentation_feedback_link_idx ON public.video_presentation_feedback (share_link_id, created_at DESC);