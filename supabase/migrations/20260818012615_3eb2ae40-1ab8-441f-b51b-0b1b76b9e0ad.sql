ALTER TABLE public.video_render_jobs
  ADD COLUMN IF NOT EXISTS credits_refunded integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false;