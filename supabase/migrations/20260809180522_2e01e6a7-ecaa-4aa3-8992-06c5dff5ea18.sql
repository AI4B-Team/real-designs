ALTER TABLE public.presentations ADD COLUMN IF NOT EXISTS line_notes jsonb NOT NULL DEFAULT '{}'::jsonb;

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
    'excluded_lines', COALESCE(pres.excluded_lines, '[]'::jsonb),
    'line_notes', COALESCE(pres.line_notes, '{}'::jsonb),
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
        'id', sl.id,
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

DROP FUNCTION IF EXISTS public.respond_to_presentation(text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.respond_to_presentation(
  _token text,
  _decision text,
  _note text DEFAULT NULL,
  _excluded jsonb DEFAULT '[]'::jsonb,
  _line_notes jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE st text; ex jsonb; ln jsonb;
BEGIN
  IF _decision NOT IN ('approved','changes') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_decision');
  END IF;
  ex := COALESCE(_excluded, '[]'::jsonb);
  IF jsonb_typeof(ex) <> 'array' OR jsonb_array_length(ex) > 200 THEN
    ex := '[]'::jsonb;
  END IF;
  ln := COALESCE(_line_notes, '{}'::jsonb);
  IF jsonb_typeof(ln) <> 'object' THEN
    ln := '{}'::jsonb;
  ELSE
    SELECT COALESCE(jsonb_object_agg(k, left(v, 400)), '{}'::jsonb) INTO ln
    FROM (
      SELECT key AS k, value AS v
      FROM jsonb_each_text(ln)
      WHERE length(btrim(value)) > 0
      LIMIT 200
    ) t;
  END IF;
  UPDATE public.presentations
     SET status = _decision,
         decision_note = NULLIF(left(COALESCE(_note,''), 1000), ''),
         excluded_lines = ex,
         line_notes = ln,
         decided_at = now()
   WHERE token = _token
  RETURNING status INTO st;
  IF st IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  RETURN jsonb_build_object('ok', true, 'status', st);
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_presentation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_to_presentation(text, text, text, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_shared_presentation(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_to_presentation(text, text, text, jsonb, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_presentation(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_presentation(text, text, text, jsonb, jsonb) TO service_role;