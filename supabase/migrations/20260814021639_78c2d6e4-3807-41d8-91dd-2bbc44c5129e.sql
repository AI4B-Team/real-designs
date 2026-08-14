CREATE TABLE public.listing_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  stage TEXT NOT NULL DEFAULT 'validating',
  error_code TEXT,
  error_message TEXT,
  listing JSONB NOT NULL DEFAULT '{}'::jsonb,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  photo_count INTEGER NOT NULL DEFAULT 0,
  property_id UUID,
  video_project_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX listing_imports_user_idx ON public.listing_imports (user_id, created_at DESC);
CREATE INDEX listing_imports_url_idx ON public.listing_imports (user_id, normalized_url);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_imports TO authenticated;
GRANT ALL ON public.listing_imports TO service_role;

ALTER TABLE public.listing_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own listing imports"
ON public.listing_imports FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_listing_imports_updated_at
BEFORE UPDATE ON public.listing_imports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();