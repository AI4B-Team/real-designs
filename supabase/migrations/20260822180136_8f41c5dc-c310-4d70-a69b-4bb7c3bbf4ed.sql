CREATE TABLE public.parcel_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  property_id UUID,
  asset_key TEXT,
  address TEXT NOT NULL,
  parcel_id TEXT,
  provider TEXT NOT NULL,
  jurisdiction TEXT,
  license TEXT,
  retrieved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'retrieved',
  error TEXT,
  geometry JSONB,
  georeference JSONB,
  alignment JSONB,
  confidence TEXT NOT NULL DEFAULT 'unaligned',
  warning_accepted BOOLEAN NOT NULL DEFAULT false,
  aligned_at TIMESTAMPTZ,
  audit JSONB NOT NULL DEFAULT '[]'::jsonb,
  export_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcel_imports TO authenticated;
GRANT ALL ON public.parcel_imports TO service_role;

ALTER TABLE public.parcel_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own parcel imports"
ON public.parcel_imports FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX parcel_imports_user_idx ON public.parcel_imports (user_id, created_at DESC);

CREATE TRIGGER update_parcel_imports_updated_at
BEFORE UPDATE ON public.parcel_imports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();