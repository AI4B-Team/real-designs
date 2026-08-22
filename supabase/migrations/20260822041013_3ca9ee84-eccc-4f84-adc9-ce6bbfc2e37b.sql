ALTER TABLE public.photo_edits
  ADD COLUMN IF NOT EXISTS editor_mode text NOT NULL DEFAULT 'source',
  ADD COLUMN IF NOT EXISTS parent_asset_key text;
CREATE INDEX IF NOT EXISTS photo_edits_parent_asset_key_idx ON public.photo_edits (parent_asset_key);