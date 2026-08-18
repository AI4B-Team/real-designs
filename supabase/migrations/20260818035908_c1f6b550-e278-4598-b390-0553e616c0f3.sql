ALTER TABLE public.scene_clips
  ADD COLUMN IF NOT EXISTS scene_key TEXT,
  ADD COLUMN IF NOT EXISTS room_name TEXT,
  ADD COLUMN IF NOT EXISTS source_version TEXT NOT NULL DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS orientation TEXT NOT NULL DEFAULT 'landscape',
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
  ADD COLUMN IF NOT EXISTS provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS scene_clips_active_key_idx
  ON public.scene_clips(video_project_id, scene_key)
  WHERE status IN ('queued', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS scene_clips_idempotency_idx
  ON public.scene_clips(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS scene_clips_status_idx ON public.scene_clips(status, last_checked_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scene_clips_status_valid') THEN
    ALTER TABLE public.scene_clips ADD CONSTRAINT scene_clips_status_valid
      CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scene_clips_seconds_positive') THEN
    ALTER TABLE public.scene_clips ADD CONSTRAINT scene_clips_seconds_positive CHECK (seconds > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scene_clips_credits_nonnegative') THEN
    ALTER TABLE public.scene_clips ADD CONSTRAINT scene_clips_credits_nonnegative
      CHECK (credits_charged >= 0 AND credits_refunded >= 0);
  END IF;
END $$;