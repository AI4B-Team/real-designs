ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS normalized_address text,
  ADD COLUMN IF NOT EXISTS address_source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS address_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS title_touched boolean NOT NULL DEFAULT false;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS normalized_address text,
  ADD COLUMN IF NOT EXISTS address_source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS address_verified_at timestamptz;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS normalized_address text;

CREATE INDEX IF NOT EXISTS properties_owner_normalized_idx ON public.properties (owner_id, normalized_address);
CREATE INDEX IF NOT EXISTS video_projects_normalized_idx ON public.video_projects (user_id, normalized_address);