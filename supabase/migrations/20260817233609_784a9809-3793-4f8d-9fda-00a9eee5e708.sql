-- Harden the room-photos read policy.
-- The first folder segment is the OWNER'S user id (the app writes
-- "{user_id}/..." and "{user_id}/renders/..."), which is exactly the argument
-- has_workspace_access() expects. The previous version cast that segment to
-- uuid unconditionally, so one legacy or malformed object name could make the
-- cast fail and break reads across the bucket. Guard the cast, and check
-- direct ownership first so a user can always read their own files.
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