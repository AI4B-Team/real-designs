CREATE TABLE public.property_media_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  property_label TEXT,
  batch_id UUID,
  room_group TEXT NOT NULL DEFAULT 'Needs Review',
  room_confidence NUMERIC NOT NULL DEFAULT 0,
  angle_group TEXT,
  hdr_group TEXT,
  dup_group TEXT,
  quality JSONB NOT NULL DEFAULT '{}'::jsonb,
  flags TEXT[] NOT NULL DEFAULT '{}',
  recommended BOOLEAN NOT NULL DEFAULT false,
  hidden BOOLEAN NOT NULL DEFAULT false,
  source_type TEXT NOT NULL DEFAULT 'computer',
  file_type TEXT,
  original_filename TEXT,
  storage_path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  file_size BIGINT,
  modification_class TEXT NOT NULL DEFAULT 'Unmodified Original',
  approved_version_id UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.property_media_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.property_media_assets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'enhanced',
  modification_class TEXT NOT NULL DEFAULT 'Enhanced',
  storage_path TEXT NOT NULL,
  ops JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.property_media_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  property_label TEXT,
  preset TEXT NOT NULL,
  label TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pma_user_property ON public.property_media_assets (user_id, property_id, created_at DESC);
CREATE INDEX idx_pmv_asset ON public.property_media_versions (asset_id, created_at DESC);
CREATE INDEX idx_pme_user ON public.property_media_exports (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_media_assets TO authenticated;
GRANT ALL ON public.property_media_assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_media_versions TO authenticated;
GRANT ALL ON public.property_media_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_media_exports TO authenticated;
GRANT ALL ON public.property_media_exports TO service_role;

ALTER TABLE public.property_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_media_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_media_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own media assets" ON public.property_media_assets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own media versions" ON public.property_media_versions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own media exports" ON public.property_media_exports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_pma_updated BEFORE UPDATE ON public.property_media_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();