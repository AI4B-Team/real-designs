-- Deliberate reuse of one photo (a duplicated scene, or a Start/End half) gets
-- an explicit role. Ordinary photo scenes leave it null and stay unique.
ALTER TABLE public.video_scenes ADD COLUMN IF NOT EXISTS scene_role text;

-- Remove proven duplicates: same project + same source, keep the earliest /
-- lowest-position row with all of its settings, captions, motion and effects.
WITH ranked AS (
  SELECT id,
         video_project_id,
         row_number() OVER (
           PARTITION BY video_project_id,
                        coalesce(source_asset_id::text, source_path),
                        coalesce(scene_role, '')
           ORDER BY sequence NULLS LAST, created_at, id
         ) AS rn
  FROM public.video_scenes
  WHERE coalesce(source_asset_id::text, source_path) IS NOT NULL
)
DELETE FROM public.video_scenes s
USING ranked r
WHERE s.id = r.id AND r.rn > 1;

-- Reindex the survivors so positions stay sequential.
WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY video_project_id ORDER BY sequence NULLS LAST, created_at, id) - 1 AS seq
  FROM public.video_scenes
)
UPDATE public.video_scenes s
SET sequence = o.seq
FROM ordered o
WHERE s.id = o.id AND s.sequence IS DISTINCT FROM o.seq;

-- One ordinary photo scene per asset per project, from here on.
CREATE UNIQUE INDEX IF NOT EXISTS video_scenes_unique_asset
  ON public.video_scenes (video_project_id, source_asset_id, coalesce(scene_role, ''))
  WHERE source_asset_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS video_scenes_unique_path
  ON public.video_scenes (video_project_id, source_path, coalesce(scene_role, ''))
  WHERE source_asset_id IS NULL AND source_path IS NOT NULL;