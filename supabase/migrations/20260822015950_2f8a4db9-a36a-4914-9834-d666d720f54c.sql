CREATE TABLE public.user_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL,
  item_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_kind, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favorites TO authenticated;
GRANT ALL ON public.user_favorites TO service_role;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own favorites" ON public.user_favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX user_favorites_user_idx ON public.user_favorites (user_id, item_kind);