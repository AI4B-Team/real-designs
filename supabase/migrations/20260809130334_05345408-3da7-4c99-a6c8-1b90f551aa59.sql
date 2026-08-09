DROP POLICY IF EXISTS room_photos_read_own ON storage.objects;
CREATE POLICY room_photos_read_own ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'room-photos' AND public.has_workspace_access(((storage.foldername(name))[1])::uuid));