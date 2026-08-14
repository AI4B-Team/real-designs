DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE IF NOT EXISTS public.style_overrides (
  style_id text PRIMARY KEY,
  display_name text,
  short_description text,
  category text,
  aliases text[],
  project_types text[],
  preview_image text,
  provider_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  generation_prompt text,
  negative_prompt text,
  sort_order integer,
  is_featured boolean,
  is_hidden boolean NOT NULL DEFAULT false,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.style_overrides TO authenticated;
GRANT SELECT ON public.style_overrides TO anon;
GRANT ALL ON public.style_overrides TO service_role;
ALTER TABLE public.style_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read style overrides" ON public.style_overrides;
CREATE POLICY "Anyone can read style overrides" ON public.style_overrides FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage style overrides" ON public.style_overrides;
CREATE POLICY "Admins manage style overrides" ON public.style_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));