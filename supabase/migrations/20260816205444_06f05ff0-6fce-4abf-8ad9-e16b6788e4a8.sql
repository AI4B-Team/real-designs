CREATE TABLE public.watched_sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  site_url TEXT NOT NULL,
  host TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'weekly',
  watch_since DATE,
  video_type TEXT NOT NULL DEFAULT 'listing_video',
  new_listing_mode TEXT NOT NULL DEFAULT 'review',
  status TEXT NOT NULL DEFAULT 'active',
  robots_ok BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  attested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attestation_version TEXT NOT NULL DEFAULT 'v1',
  attestation_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watched_sites TO authenticated;
GRANT ALL ON public.watched_sites TO service_role;
ALTER TABLE public.watched_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own watched sites" ON public.watched_sites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX watched_sites_user_idx ON public.watched_sites (user_id, created_at DESC);
CREATE TRIGGER update_watched_sites_updated_at BEFORE UPDATE ON public.watched_sites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();