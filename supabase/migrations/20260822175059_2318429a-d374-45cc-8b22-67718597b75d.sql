CREATE TABLE public.photo_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_key TEXT,
  property_id UUID,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  photo_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_batches TO authenticated;
GRANT ALL ON public.photo_batches TO service_role;

ALTER TABLE public.photo_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own photo batches"
ON public.photo_batches FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX photo_batches_user_updated_idx ON public.photo_batches (user_id, updated_at DESC);

CREATE TRIGGER update_photo_batches_updated_at
BEFORE UPDATE ON public.photo_batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();