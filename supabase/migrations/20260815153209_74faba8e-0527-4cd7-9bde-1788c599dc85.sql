CREATE TABLE public.crm_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT,
  credential TEXT NOT NULL,
  endpoint TEXT,
  status TEXT NOT NULL DEFAULT 'connected',
  account_name TEXT,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  auto_push BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_connections TO authenticated;
GRANT ALL ON public.crm_connections TO service_role;
ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own CRM connections" ON public.crm_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.crm_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.crm_connections(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  stage TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own CRM contacts" ON public.crm_contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.crm_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  connection_id UUID REFERENCES public.crm_connections(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.crm_sync_log TO authenticated;
GRANT ALL ON public.crm_sync_log TO service_role;
ALTER TABLE public.crm_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own CRM sync log" ON public.crm_sync_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users write their own CRM sync log" ON public.crm_sync_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER crm_connections_updated_at BEFORE UPDATE ON public.crm_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER crm_contacts_updated_at BEFORE UPDATE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();