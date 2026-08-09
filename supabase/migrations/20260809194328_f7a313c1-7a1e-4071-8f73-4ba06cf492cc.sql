ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.record_presentation_reminder(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.presentations pres
    JOIN public.versions v ON v.id = pres.version_id
    JOIN public.rooms r ON r.id = v.room_id
    JOIN public.projects pr ON pr.id = r.project_id
    JOIN public.properties p ON p.id = pr.property_id
    WHERE pres.id = _id AND public.has_workspace_access(p.owner_id)
  ) THEN
    RAISE EXCEPTION 'not found';
  END IF;

  UPDATE public.presentations
     SET reminded_at = now(),
         reminder_count = COALESCE(reminder_count, 0) + 1
   WHERE id = _id
  RETURNING reminder_count INTO n;

  INSERT INTO public.presentation_events (presentation_id, kind, detail, meta)
  VALUES (_id, 'reminded',
          CASE WHEN n <= 1 THEN 'Reminder sent to the client'
               ELSE 'Reminder ' || n || ' sent to the client' END,
          jsonb_build_object('reminder_count', n));
END;
$function$;

REVOKE ALL ON FUNCTION public.record_presentation_reminder(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_presentation_reminder(uuid) TO authenticated;