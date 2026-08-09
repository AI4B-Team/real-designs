CREATE TABLE public.presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.versions(id) ON DELETE CASCADE,
  title text NOT NULL,
  client_name text,
  client_email text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  status text NOT NULL DEFAULT 'sent',
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX presentations_version_idx ON public.presentations(version_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentations TO authenticated;
GRANT ALL ON public.presentations TO service_role;

ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY presentations_own ON public.presentations FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.versions v
  JOIN public.rooms r ON r.id = v.room_id
  JOIN public.projects pr ON pr.id = r.project_id
  JOIN public.properties p ON p.id = pr.property_id
  WHERE v.id = presentations.version_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.versions v
  JOIN public.rooms r ON r.id = v.room_id
  JOIN public.projects pr ON pr.id = r.project_id
  JOIN public.properties p ON p.id = pr.property_id
  WHERE v.id = presentations.version_id AND p.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.get_shared_presentation(_token text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'title', pres.title,
    'client_name', pres.client_name,
    'status', pres.status,
    'decision_note', pres.decision_note,
    'address', p.address,
    'project_name', pr.name,
    'room_name', r.name,
    'room_type', r.room_type,
    'grade', pr.finish_grade,
    'style', v.style,
    'version_no', v.version_no,
    'before_path', v.before_path,
    'after_path', v.after_path,
    'created_at', pres.created_at,
    'total_low', s.total_low,
    'total_high', s.total_high,
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'description', sl.description, 'trade', sl.trade,
        'qty', sl.qty, 'uom', sl.uom,
        'low', sl.line_low, 'high', sl.line_high) ORDER BY sl.trade)
      FROM public.scope_lines sl WHERE sl.scope_id = s.id), '[]'::jsonb)
  )
  FROM public.presentations pres
  JOIN public.versions v ON v.id = pres.version_id
  JOIN public.rooms r ON r.id = v.room_id
  JOIN public.projects pr ON pr.id = r.project_id
  JOIN public.properties p ON p.id = pr.property_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.scopes sc WHERE sc.version_id = v.id
    ORDER BY sc.computed_at DESC LIMIT 1) s ON true
  WHERE pres.token = _token;
$$;

CREATE OR REPLACE FUNCTION public.record_presentation_view(_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.presentations
     SET view_count = view_count + 1, last_viewed_at = now(),
         status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
   WHERE token = _token;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_presentation(_token text, _decision text, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE st text;
BEGIN
  IF _decision NOT IN ('approved','changes') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_decision');
  END IF;
  UPDATE public.presentations
     SET status = _decision, decision_note = NULLIF(left(COALESCE(_note,''), 1000), ''), decided_at = now()
   WHERE token = _token
  RETURNING status INTO st;
  IF st IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  RETURN jsonb_build_object('ok', true, 'status', st);
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_presentation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_presentation_view(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_to_presentation(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_presentation(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_presentation_view(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_presentation(text, text, text) TO anon, authenticated, service_role;