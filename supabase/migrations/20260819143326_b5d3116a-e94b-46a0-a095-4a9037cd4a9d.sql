ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS source_path text;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DROP TRIGGER IF EXISTS rooms_updated_at ON public.rooms;
CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX IF NOT EXISTS rooms_project_source_path_idx ON public.rooms (project_id, source_path) WHERE source_path IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS versions_room_after_path_idx ON public.versions (room_id, after_path) WHERE after_path IS NOT NULL;