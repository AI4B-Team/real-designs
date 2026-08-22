CREATE TABLE public.export_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classification text NOT NULL,
  disclosure_id text NOT NULL,
  disclosure_text text,
  export_preset text NOT NULL,
  scope text NOT NULL,
  asset_id text,
  version_id text,
  file_name text,
  exported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX export_audits_user_idx ON public.export_audits (user_id, exported_at DESC);
GRANT SELECT, INSERT ON public.export_audits TO authenticated;
GRANT ALL ON public.export_audits TO service_role;
ALTER TABLE public.export_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own export audits" ON public.export_audits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users record their own export audits" ON public.export_audits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);