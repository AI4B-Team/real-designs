CREATE TABLE public.photo_markups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_key TEXT NOT NULL,
  source_path TEXT,
  property_id UUID,
  room_id UUID,
  version_id TEXT,
  document JSONB NOT NULL DEFAULT '{}'::jsonb,
  layer_count INTEGER NOT NULL DEFAULT 0,
  requires_warning BOOLEAN NOT NULL DEFAULT false,
  visible_disclosure BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, asset_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_markups TO authenticated;
GRANT ALL ON public.photo_markups TO service_role;

ALTER TABLE public.photo_markups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own photo markups"
ON public.photo_markups FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX photo_markups_user_asset_idx ON public.photo_markups (user_id, asset_key);

CREATE TRIGGER update_photo_markups_updated_at
BEFORE UPDATE ON public.photo_markups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();