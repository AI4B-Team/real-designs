CREATE TABLE public.presentation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  detail text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX presentation_events_pid_idx ON public.presentation_events (presentation_id, created_at DESC);

GRANT SELECT ON public.presentation_events TO authenticated;
GRANT ALL ON public.presentation_events TO service_role;

ALTER TABLE public.presentation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presentation_events_own_read" ON public.presentation_events
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.presentations pres
  JOIN public.versions v ON v.id = pres.version_id
  JOIN public.rooms r ON r.id = v.room_id
  JOIN public.projects pr ON pr.id = r.project_id
  JOIN public.properties p ON p.id = pr.property_id
  WHERE pres.id = presentation_events.presentation_id
    AND public.has_workspace_access(p.owner_id)
));

CREATE OR REPLACE FUNCTION public.record_presentation_view(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE pid uuid; n integer;
BEGIN
  UPDATE public.presentations
     SET view_count = view_count + 1, last_viewed_at = now(),
         status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
   WHERE token = _token
  RETURNING id, view_count INTO pid, n;

  IF pid IS NOT NULL THEN
    INSERT INTO public.presentation_events (presentation_id, kind, detail)
    VALUES (pid, 'viewed', CASE WHEN n = 1 THEN 'Opened for the first time' ELSE 'Opened again (view ' || n || ')' END);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_presentation(_token text, _decision text, _note text DEFAULT NULL::text, _excluded jsonb DEFAULT '[]'::jsonb, _line_notes jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE st text; ex jsonb; ln jsonb; pid uuid; nname text;
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
  RETURNING status, id, client_name INTO st, pid, nname;
  IF st IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

  INSERT INTO public.presentation_events (presentation_id, kind, detail, meta)
  VALUES (
    pid,
    CASE WHEN st = 'approved' THEN 'approved' ELSE 'changes' END,
    CASE WHEN st = 'approved' THEN COALESCE(nname, 'The client') || ' approved the package'
         ELSE COALESCE(nname, 'The client') || ' requested changes' END,
    jsonb_build_object(
      'note', NULLIF(left(COALESCE(_note,''), 1000), ''),
      'excluded_count', jsonb_array_length(ex),
      'note_count', (SELECT count(*) FROM jsonb_object_keys(ln))
    )
  );

  IF (SELECT count(*) FROM jsonb_object_keys(ln)) > 0 THEN
    INSERT INTO public.presentation_events (presentation_id, kind, detail, meta)
    VALUES (pid, 'comments',
      COALESCE(nname, 'The client') || ' left ' || (SELECT count(*) FROM jsonb_object_keys(ln)) || ' line comment(s)',
      jsonb_build_object('line_notes', ln));
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', st);
END;
$function$;