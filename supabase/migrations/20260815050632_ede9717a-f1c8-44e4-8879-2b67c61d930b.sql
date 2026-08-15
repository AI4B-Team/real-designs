CREATE POLICY "user audio read own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'user-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "user audio insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "user audio update own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'user-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "user audio delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-audio' AND auth.uid()::text = (storage.foldername(name))[1]);