CREATE TABLE public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Brand Kit',
  kit_type text not null default 'personal',
  company_name text,
  logo_url text,
  profile_photo_url text,
  colors jsonb not null default '{}'::jsonb,
  font text,
  contact_name text,
  email text,
  phone text,
  website text,
  social_links jsonb not null default '{}'::jsonb,
  default_cta text,
  intro_enabled boolean not null default false,
  outro_enabled boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_kits TO authenticated;
GRANT ALL ON public.brand_kits TO service_role;
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own brand kits" ON public.brand_kits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.video_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  property_label text,
  room_id uuid,
  design_version_id uuid,
  title text not null default 'Untitled Reveal',
  video_type text not null default 'property_tour',
  source_type text not null default 'property',
  status text not null default 'draft',
  formats jsonb not null default '["9:16"]'::jsonb,
  length_preset text not null default 'standard',
  transition text not null default 'clean',
  motion text not null default 'auto',
  brand_kit_id uuid references public.brand_kits(id) on delete set null,
  branding jsonb not null default '{}'::jsonb,
  disclosure jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_projects TO authenticated;
GRANT ALL ON public.video_projects TO service_role;
ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own video projects" ON public.video_projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX video_projects_user_idx ON public.video_projects(user_id, created_at DESC);

CREATE TABLE public.video_scenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_project_id uuid not null references public.video_projects(id) on delete cascade,
  source_asset_id uuid,
  source_version_id uuid,
  source_path text,
  compare_path text,
  room_name text,
  sequence integer not null default 0,
  scene_type text not null default 'design',
  duration numeric not null default 3,
  motion text not null default 'auto',
  crop_data jsonb not null default '{}'::jsonb,
  transition text not null default 'clean',
  caption text,
  disclosure_type text,
  generation_status text not null default 'pending',
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_scenes TO authenticated;
GRANT ALL ON public.video_scenes TO service_role;
ALTER TABLE public.video_scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own video scenes" ON public.video_scenes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX video_scenes_project_idx ON public.video_scenes(video_project_id, sequence);

CREATE TABLE public.video_variants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_project_id uuid not null references public.video_projects(id) on delete cascade,
  aspect_ratio text not null default '9:16',
  brand_kit_id uuid references public.brand_kits(id) on delete set null,
  version_type text not null default 'branded',
  resolution text,
  render_status text not null default 'queued',
  output_path text,
  thumbnail_path text,
  duration numeric,
  credit_cost integer not null default 0,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_variants TO authenticated;
GRANT ALL ON public.video_variants TO service_role;
ALTER TABLE public.video_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own video variants" ON public.video_variants FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX video_variants_project_idx ON public.video_variants(video_project_id);

CREATE TABLE public.video_audio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_project_id uuid not null references public.video_projects(id) on delete cascade unique,
  presentation_style text not null default 'music',
  music_track_id text,
  music_volume numeric not null default 0.6,
  beat_sync boolean not null default true,
  narration_type text not null default 'none',
  narration_script text,
  voice_id text,
  narration_url text,
  captions_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_audio TO authenticated;
GRANT ALL ON public.video_audio TO service_role;
ALTER TABLE public.video_audio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own video audio" ON public.video_audio FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.video_share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_project_id uuid not null references public.video_projects(id) on delete cascade,
  token text not null unique,
  privacy_type text not null default 'public',
  password_hash text,
  expires_at timestamptz,
  allow_download boolean not null default true,
  show_project_details boolean not null default true,
  show_products boolean not null default false,
  show_budget boolean not null default false,
  comments_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_share_links TO authenticated;
GRANT ALL ON public.video_share_links TO service_role;
ALTER TABLE public.video_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own video share links" ON public.video_share_links FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);