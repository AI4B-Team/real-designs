/**
 * Ownership guards for scene clips — server only.
 *
 * The client may name a project, a scene and a photo; it may never assert that
 * they are its own. Everything here is checked through the caller's own
 * (RLS-scoped) Supabase client, or against the caller's storage folder.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertClipOwnership(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  input: { video_project_id: string; scene_id?: string | null; source_path: string },
): Promise<void> {
  const { data: project, error } = await supabase
    .from("video_projects")
    .select("id")
    .eq("id", input.video_project_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!project) throw new Error("That video project is not available on this account.");

  if (input.scene_id) {
    const { data: scene } = await supabase
      .from("video_scenes")
      .select("id, video_project_id")
      .eq("id", input.scene_id)
      .maybeSingle();
    if (!scene || (scene as any).video_project_id !== input.video_project_id)
      throw new Error("That scene does not belong to this video project.");
  }

  // Stored photos live under `${userId}/…` in the private bucket.
  const path = input.source_path;
  const stored = !/^(https?:|blob:|data:|\/)/.test(path);
  if (stored && !path.startsWith(`${userId}/`))
    throw new Error("That photo is not available on this account.");
  if (!stored && !/^https?:/.test(path))
    throw new Error("That photo cannot be animated. Upload it first.");
}

export async function removeClipObject(storagePath?: string | null): Promise<void> {
  if (!storagePath) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { CLIP_BUCKET } = await import("@/lib/scene-clips.server");
  await supabaseAdmin.storage.from(CLIP_BUCKET).remove([storagePath]);
}
