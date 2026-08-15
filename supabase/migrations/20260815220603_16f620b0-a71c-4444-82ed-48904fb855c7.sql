DO $$
DECLARE r RECORD; survivor uuid;
BEGIN
  FOR r IN
    SELECT owner_id FROM public.properties
    WHERE address IS NULL OR btrim(address) = ''
       OR lower(btrim(address)) IN ('untitled property','unsorted uploads')
    GROUP BY owner_id HAVING count(*) > 1
  LOOP
    SELECT id INTO survivor FROM public.properties
     WHERE owner_id = r.owner_id
       AND (address IS NULL OR btrim(address) = ''
            OR lower(btrim(address)) IN ('untitled property','unsorted uploads'))
     ORDER BY created_at ASC LIMIT 1;

    UPDATE public.property_media_assets a SET property_id = survivor
      FROM public.properties p WHERE a.property_id = p.id AND p.owner_id = r.owner_id AND p.id <> survivor
      AND (p.address IS NULL OR btrim(p.address) = '' OR lower(btrim(p.address)) IN ('untitled property','unsorted uploads'));
    UPDATE public.projects a SET property_id = survivor
      FROM public.properties p WHERE a.property_id = p.id AND p.owner_id = r.owner_id AND p.id <> survivor
      AND (p.address IS NULL OR btrim(p.address) = '' OR lower(btrim(p.address)) IN ('untitled property','unsorted uploads'));
    UPDATE public.property_media_exports a SET property_id = survivor
      FROM public.properties p WHERE a.property_id = p.id AND p.owner_id = r.owner_id AND p.id <> survivor
      AND (p.address IS NULL OR btrim(p.address) = '' OR lower(btrim(p.address)) IN ('untitled property','unsorted uploads'));
    UPDATE public.presentation_packages a SET property_id = survivor
      FROM public.properties p WHERE a.property_id = p.id AND p.owner_id = r.owner_id AND p.id <> survivor
      AND (p.address IS NULL OR btrim(p.address) = '' OR lower(btrim(p.address)) IN ('untitled property','unsorted uploads'));
    UPDATE public.video_projects a SET property_id = survivor
      FROM public.properties p WHERE a.property_id = p.id AND p.owner_id = r.owner_id AND p.id <> survivor
      AND (p.address IS NULL OR btrim(p.address) = '' OR lower(btrim(p.address)) IN ('untitled property','unsorted uploads'));
    UPDATE public.listing_imports a SET property_id = survivor
      FROM public.properties p WHERE a.property_id = p.id AND p.owner_id = r.owner_id AND p.id <> survivor
      AND (p.address IS NULL OR btrim(p.address) = '' OR lower(btrim(p.address)) IN ('untitled property','unsorted uploads'));

    DELETE FROM public.properties p
     WHERE p.owner_id = r.owner_id AND p.id <> survivor
       AND (p.address IS NULL OR btrim(p.address) = ''
            OR lower(btrim(p.address)) IN ('untitled property','unsorted uploads'));

    UPDATE public.properties SET address = 'Untitled Property' WHERE id = survivor;
  END LOOP;
END $$;