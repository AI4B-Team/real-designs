ALTER TABLE public.photo_edits
  ADD COLUMN IF NOT EXISTS geometry jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS modification_class text;