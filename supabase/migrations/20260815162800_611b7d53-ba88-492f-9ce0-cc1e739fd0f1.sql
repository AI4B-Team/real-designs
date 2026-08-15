CREATE TABLE public.signup_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  company text,
  role text,
  how_heard text,
  how_heard_detail text,
  listings_per_year text,
  primary_goal text,
  team_size text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  skipped boolean NOT NULL DEFAULT false,
  crm_pushed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.signup_profiles TO authenticated;
GRANT ALL ON public.signup_profiles TO service_role;

ALTER TABLE public.signup_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own signup profile"
  ON public.signup_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all signup profiles"
  ON public.signup_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_signup_profiles_updated_at
  BEFORE UPDATE ON public.signup_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();