-- ============ presentation packages ============
CREATE TABLE public.presentation_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  property_label text,
  project_name text,
  client_name text,
  client_email text,
  intro text,
  logo_url text,
  accent text NOT NULL DEFAULT '#CC0000',
  cover_url text,
  status text NOT NULL DEFAULT 'draft',
  archived boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  last_activity text,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_packages TO authenticated;
GRANT ALL ON public.presentation_packages TO service_role;
ALTER TABLE public.presentation_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace manages own presentation packages"
  ON public.presentation_packages FOR ALL TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.has_workspace_access(user_id));

CREATE TRIGGER trg_presentation_packages_updated
  BEFORE UPDATE ON public.presentation_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ sections ============
CREATE TABLE public.presentation_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.presentation_packages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  title text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, section_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_sections TO authenticated;
GRANT ALL ON public.presentation_sections TO service_role;
ALTER TABLE public.presentation_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace manages own presentation sections"
  ON public.presentation_sections FOR ALL TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.has_workspace_access(user_id));

-- ============ assets ============
CREATE TABLE public.presentation_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.presentation_packages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  kind text NOT NULL,
  title text,
  caption text,
  url text,
  compare_url text,
  source_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_assets TO authenticated;
GRANT ALL ON public.presentation_assets TO service_role;
ALTER TABLE public.presentation_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace manages own presentation assets"
  ON public.presentation_assets FOR ALL TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.has_workspace_access(user_id));

-- ============ links ============
CREATE TABLE public.presentation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.presentation_packages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  access_code text,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_links TO authenticated;
GRANT ALL ON public.presentation_links TO service_role;
ALTER TABLE public.presentation_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace manages own presentation links"
  ON public.presentation_links FOR ALL TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.has_workspace_access(user_id));

-- ============ comments ============
CREATE TABLE public.presentation_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.presentation_packages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_id uuid REFERENCES public.presentation_links(id) ON DELETE SET NULL,
  section_key text,
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_comments TO authenticated;
GRANT ALL ON public.presentation_comments TO service_role;
ALTER TABLE public.presentation_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace reads own presentation comments"
  ON public.presentation_comments FOR ALL TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.has_workspace_access(user_id));

-- ============ decisions ============
CREATE TABLE public.presentation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.presentation_packages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_id uuid REFERENCES public.presentation_links(id) ON DELETE SET NULL,
  decision text NOT NULL,
  client_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_decisions TO authenticated;
GRANT ALL ON public.presentation_decisions TO service_role;
ALTER TABLE public.presentation_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace reads own presentation decisions"
  ON public.presentation_decisions FOR ALL TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.has_workspace_access(user_id));

-- ============ activity ============
CREATE TABLE public.presentation_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.presentation_packages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  detail text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_activity TO authenticated;
GRANT ALL ON public.presentation_activity TO service_role;
ALTER TABLE public.presentation_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace manages own presentation activity"
  ON public.presentation_activity FOR ALL TO authenticated
  USING (public.has_workspace_access(user_id))
  WITH CHECK (public.has_workspace_access(user_id));

CREATE INDEX idx_pres_pkg_user ON public.presentation_packages(user_id, created_at DESC);
CREATE INDEX idx_pres_assets_pkg ON public.presentation_assets(package_id, sort_order);
CREATE INDEX idx_pres_sections_pkg ON public.presentation_sections(package_id, sort_order);
CREATE INDEX idx_pres_links_pkg ON public.presentation_links(package_id, created_at DESC);
CREATE INDEX idx_pres_activity_pkg ON public.presentation_activity(package_id, created_at DESC);

-- ============ public client access ============
CREATE OR REPLACE FUNCTION public.get_presentation_share(_token text, _code text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.presentation_links;
  p public.presentation_packages;
BEGIN
  SELECT * INTO l FROM public.presentation_links WHERE token = _token;
  IF l.id IS NULL OR l.revoked THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF l.expires_at IS NOT NULL AND l.expires_at < now() THEN RETURN jsonb_build_object('error', 'expired'); END IF;
  IF l.access_code IS NOT NULL AND l.access_code <> '' AND coalesce(_code, '') <> l.access_code THEN
    RETURN jsonb_build_object('error', 'code_required');
  END IF;

  SELECT * INTO p FROM public.presentation_packages WHERE id = l.package_id;
  IF p.id IS NULL OR p.archived THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  RETURN jsonb_build_object(
    'link_id', l.id,
    'package_id', p.id,
    'title', p.title,
    'property_label', p.property_label,
    'project_name', p.project_name,
    'client_name', p.client_name,
    'intro', p.intro,
    'logo_url', p.logo_url,
    'accent', p.accent,
    'cover_url', p.cover_url,
    'status', p.status,
    'settings', p.settings,
    'created_at', p.created_at,
    'sections', coalesce((
      SELECT jsonb_agg(jsonb_build_object('key', s.section_key, 'title', s.title, 'sort_order', s.sort_order) ORDER BY s.sort_order)
      FROM public.presentation_sections s WHERE s.package_id = p.id AND s.hidden = false
    ), '[]'::jsonb),
    'assets', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'section_key', a.section_key, 'kind', a.kind, 'title', a.title,
        'caption', a.caption, 'url', a.url, 'compare_url', a.compare_url, 'meta', a.meta,
        'sort_order', a.sort_order) ORDER BY a.sort_order)
      FROM public.presentation_assets a WHERE a.package_id = p.id
    ), '[]'::jsonb),
    'comments', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'section_key', c.section_key,
        'author_name', c.author_name, 'body', c.body, 'created_at', c.created_at) ORDER BY c.created_at)
      FROM public.presentation_comments c WHERE c.package_id = p.id
    ), '[]'::jsonb),
    'decision', (
      SELECT jsonb_build_object('decision', d.decision, 'client_name', d.client_name,
        'note', d.note, 'created_at', d.created_at)
      FROM public.presentation_decisions d WHERE d.package_id = p.id
      ORDER BY d.created_at DESC LIMIT 1
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_presentation_share_view(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE l public.presentation_links;
BEGIN
  SELECT * INTO l FROM public.presentation_links WHERE token = _token;
  IF l.id IS NULL OR l.revoked THEN RETURN; END IF;
  UPDATE public.presentation_links SET view_count = view_count + 1, last_viewed_at = now() WHERE id = l.id;
  UPDATE public.presentation_packages
     SET view_count = view_count + 1, last_viewed_at = now(),
         last_activity = 'Link opened', last_activity_at = now(),
         status = CASE WHEN status IN ('draft','shared') THEN 'viewed' ELSE status END
   WHERE id = l.package_id;
  INSERT INTO public.presentation_activity (package_id, user_id, kind, detail)
  SELECT l.package_id, p.user_id, 'opened', 'Client opened the link'
  FROM public.presentation_packages p WHERE p.id = l.package_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_presentation_comment(_token text, _section text, _name text, _body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE l public.presentation_links; p public.presentation_packages;
BEGIN
  IF coalesce(trim(_body), '') = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty'); END IF;
  SELECT * INTO l FROM public.presentation_links WHERE token = _token;
  IF l.id IS NULL OR l.revoked THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  SELECT * INTO p FROM public.presentation_packages WHERE id = l.package_id;
  IF p.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF coalesce((p.settings->>'allow_comments')::boolean, true) = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'disabled');
  END IF;

  INSERT INTO public.presentation_comments (package_id, user_id, link_id, section_key, author_name, body)
  VALUES (p.id, p.user_id, l.id, _section, nullif(trim(coalesce(_name,'')),''), trim(_body));

  UPDATE public.presentation_packages
     SET last_activity = 'Comment added', last_activity_at = now() WHERE id = p.id;
  INSERT INTO public.presentation_activity (package_id, user_id, kind, detail, meta)
  VALUES (p.id, p.user_id, 'comment', coalesce(nullif(trim(coalesce(_name,'')),''),'A client') || ' left a comment',
          jsonb_build_object('section', _section, 'body', trim(_body)));
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_presentation_share(_token text, _decision text, _name text, _note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE l public.presentation_links; p public.presentation_packages; new_status text;
BEGIN
  IF _decision NOT IN ('approved','changes') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_decision'); END IF;
  SELECT * INTO l FROM public.presentation_links WHERE token = _token;
  IF l.id IS NULL OR l.revoked THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  SELECT * INTO p FROM public.presentation_packages WHERE id = l.package_id;
  IF p.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF p.status = 'approved' THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_approved'); END IF;
  IF _decision = 'approved' AND coalesce((p.settings->>'allow_approve')::boolean, true) = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'disabled'); END IF;
  IF _decision = 'changes' AND coalesce((p.settings->>'allow_changes')::boolean, true) = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'disabled'); END IF;
  IF _decision = 'changes' AND coalesce(trim(_note), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'note_required'); END IF;
  IF _decision = 'approved' AND coalesce(trim(_name), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_required'); END IF;

  INSERT INTO public.presentation_decisions (package_id, user_id, link_id, decision, client_name, note)
  VALUES (p.id, p.user_id, l.id, _decision, nullif(trim(coalesce(_name,'')),''), nullif(trim(coalesce(_note,'')),''));

  new_status := CASE WHEN _decision = 'approved' THEN 'approved' ELSE 'changes' END;
  UPDATE public.presentation_packages
     SET status = new_status,
         last_activity = CASE WHEN _decision = 'approved' THEN 'Approved by client' ELSE 'Changes requested' END,
         last_activity_at = now()
   WHERE id = p.id;

  INSERT INTO public.presentation_activity (package_id, user_id, kind, detail, meta)
  VALUES (p.id, p.user_id, _decision,
          CASE WHEN _decision = 'approved'
               THEN coalesce(nullif(trim(coalesce(_name,'')),''),'The client') || ' approved the presentation'
               ELSE coalesce(nullif(trim(coalesce(_name,'')),''),'The client') || ' requested changes' END,
          jsonb_build_object('note', nullif(trim(coalesce(_note,'')),'')));

  RETURN jsonb_build_object('ok', true, 'status', new_status);
END;
$$;