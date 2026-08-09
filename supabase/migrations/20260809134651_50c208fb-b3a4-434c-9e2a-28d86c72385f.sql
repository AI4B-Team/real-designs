CREATE OR REPLACE FUNCTION public.enforce_founding_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  SELECT COUNT(*) INTO n FROM public.founding_members;
  IF n >= 500 THEN
    RAISE EXCEPTION 'Founding member spots are gone';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_founding_cap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_founding_cap_trg ON public.founding_members;
CREATE TRIGGER enforce_founding_cap_trg
BEFORE INSERT ON public.founding_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_founding_cap();

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='founding_members' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.founding_members', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can claim their own founding spot"
ON public.founding_members FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);