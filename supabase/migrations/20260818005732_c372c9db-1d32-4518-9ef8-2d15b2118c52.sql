DROP POLICY IF EXISTS room_photos_insert_own ON storage.objects;
CREATE POLICY room_photos_insert_own ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'room-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS room_photos_update_own ON storage.objects;
CREATE POLICY room_photos_update_own ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'room-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'room-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS room_photos_delete_own ON storage.objects;
CREATE POLICY room_photos_delete_own ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'room-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS room_photos_read_own ON storage.objects;
CREATE POLICY room_photos_read_own ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'room-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND public.has_workspace_access(((storage.foldername(name))[1])::uuid)
    )
  )
);

DROP POLICY IF EXISTS "reveal videos insert own" ON storage.objects;
CREATE POLICY "reveal videos insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reveal-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "reveal videos read own" ON storage.objects;
CREATE POLICY "reveal videos read own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reveal-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "reveal videos update own" ON storage.objects;
CREATE POLICY "reveal videos update own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'reveal-videos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'reveal-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "reveal videos delete own" ON storage.objects;
CREATE POLICY "reveal videos delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reveal-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "user audio insert own" ON storage.objects;
CREATE POLICY "user audio insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "user audio read own" ON storage.objects;
CREATE POLICY "user audio read own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'user-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "user audio update own" ON storage.objects;
CREATE POLICY "user audio update own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'user-audio' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'user-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "user audio delete own" ON storage.objects;
CREATE POLICY "user audio delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-audio' AND (storage.foldername(name))[1] = auth.uid()::text);