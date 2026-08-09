ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS brand_accent text;

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
    'brand_name', pres.brand_name,
    'brand_accent', pres.brand_accent,
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

REVOKE ALL ON FUNCTION public.get_shared_presentation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_presentation(text) TO anon, authenticated, service_role;