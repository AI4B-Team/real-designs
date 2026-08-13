CREATE POLICY "reveal videos read own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reveal-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "reveal videos insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reveal-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "reveal videos update own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'reveal-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "reveal videos delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'reveal-videos' AND auth.uid()::text = (storage.foldername(name))[1]);