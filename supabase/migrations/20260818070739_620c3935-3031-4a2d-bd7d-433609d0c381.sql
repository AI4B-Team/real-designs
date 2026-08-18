ALTER TABLE public.scene_start_end
  ADD COLUMN IF NOT EXISTS motion_preset text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS prompt text,
  ADD COLUMN IF NOT EXISTS seconds integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS aspect text,
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS credits_reserved integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_charged integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clip_path text;