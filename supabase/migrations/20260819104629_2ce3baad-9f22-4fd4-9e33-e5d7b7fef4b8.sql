-- REAL DESIGNS: production hardening (indexes, least-privilege grants,
-- transactional presentation child replacement).

-- 1. Missing lookup indexes on ownership / relationship columns.
CREATE INDEX IF NOT EXISTS idx_brand_kits_user ON public.brand_kits(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user ON public.crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_log_user ON public.crm_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_imports_property ON public.listing_imports(property_id);
CREATE INDEX IF NOT EXISTS idx_listing_imports_video_project ON public.listing_imports(video_project_id);
CREATE INDEX IF NOT EXISTS idx_market_requests_user ON public.market_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pres_activity_user ON public.presentation_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_pres_assets_user ON public.presentation_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_pres_comments_pkg ON public.presentation_comments(package_id);
CREATE INDEX IF NOT EXISTS idx_pres_comments_user ON public.presentation_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_pres_decisions_pkg ON public.presentation_decisions(package_id);
CREATE INDEX IF NOT EXISTS idx_pres_decisions_user ON public.presentation_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_pres_links_user ON public.presentation_links(user_id);
CREATE INDEX IF NOT EXISTS idx_pres_packages_property ON public.presentation_packages(property_id);
CREATE INDEX IF NOT EXISTS idx_pres_sections_user ON public.presentation_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_project_drafts_video_project ON public.project_drafts(video_project_id);
CREATE INDEX IF NOT EXISTS idx_pma_property ON public.property_media_assets(property_id);
CREATE INDEX IF NOT EXISTS idx_pme_property ON public.property_media_exports(property_id);
CREATE INDEX IF NOT EXISTS idx_pmv_user ON public.property_media_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_scene_start_end_scene ON public.scene_start_end(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_start_end_user ON public.scene_start_end(user_id);
CREATE INDEX IF NOT EXISTS idx_video_audio_user ON public.video_audio(user_id);
CREATE INDEX IF NOT EXISTS idx_video_feedback_user ON public.video_presentation_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_video_projects_property ON public.video_projects(property_id);
CREATE INDEX IF NOT EXISTS idx_video_projects_room ON public.video_projects(room_id);
CREATE INDEX IF NOT EXISTS idx_video_scenes_user ON public.video_scenes(user_id);
CREATE INDEX IF NOT EXISTS idx_video_share_links_user ON public.video_share_links(user_id);
CREATE INDEX IF NOT EXISTS idx_video_share_links_project ON public.video_share_links(video_project_id);
CREATE INDEX IF NOT EXISTS idx_video_transitions_user ON public.video_transitions(user_id);
CREATE INDEX IF NOT EXISTS idx_video_variants_user ON public.video_variants(user_id);

-- 2. Least privilege: no public table is reachable by anon. Every client-facing
-- policy is scoped TO authenticated; the client share portal reads only through
-- SECURITY DEFINER token functions, which do not need table grants.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.relname);
  END LOOP;
END $$;

-- Retention/audit tables are written only by privileged server code.
REVOKE ALL ON public.account_deletions FROM authenticated;
REVOKE ALL ON public.billing_retention FROM authenticated;
GRANT ALL ON public.account_deletions TO service_role;
GRANT ALL ON public.billing_retention TO service_role;

-- Future tables must be granted explicitly, never inherited by anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- 3. Transactional replacement of a presentation's children. Runs as the
-- caller (RLS applies) so a failed insert rolls the deletes back instead of
-- leaving a package with no sections or assets.
CREATE OR REPLACE FUNCTION public.replace_presentation_children(
  _package_id uuid,
  _sections jsonb,
  _assets jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.presentation_packages WHERE id = _package_id) THEN
    RAISE EXCEPTION 'package not found';
  END IF;

  IF _sections IS NOT NULL AND jsonb_typeof(_sections) = 'array' THEN
    DELETE FROM public.presentation_sections WHERE package_id = _package_id;
    INSERT INTO public.presentation_sections (package_id, user_id, section_key, title, hidden, sort_order)
    SELECT _package_id, uid, s->>'section_key', s->>'title',
           coalesce((s->>'hidden')::boolean, false),
           coalesce((s->>'sort_order')::int, (i - 1)::int)
    FROM jsonb_array_elements(_sections) WITH ORDINALITY AS e(s, i);
  END IF;

  IF _assets IS NOT NULL AND jsonb_typeof(_assets) = 'array' THEN
    DELETE FROM public.presentation_assets WHERE package_id = _package_id;
    INSERT INTO public.presentation_assets
      (package_id, user_id, section_key, kind, title, caption, url, compare_url, source_id, meta, sort_order)
    SELECT _package_id, uid, a->>'section_key', a->>'kind', a->>'title', a->>'caption',
           a->>'url', a->>'compare_url', nullif(a->>'source_id','')::uuid,
           coalesce(a->'meta', '{}'::jsonb), coalesce((a->>'sort_order')::int, (i - 1)::int)
    FROM jsonb_array_elements(_assets) WITH ORDINALITY AS e(a, i);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_presentation_children(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_presentation_children(uuid, jsonb, jsonb) TO authenticated;