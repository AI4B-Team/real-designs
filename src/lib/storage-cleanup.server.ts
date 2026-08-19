/**
 * Cleanup for abandoned uploads and stalled jobs.
 *
 * Deliberately conservative: an object is removed only when it is inside the
 * caller's own folder, older than the grace window, and referenced by no row
 * in the database. Shared Media rows are never touched here — detaching media
 * from a property only clears `property_id`, it does not delete the source.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GRACE_MS = 24 * 60 * 60 * 1000;

export type CleanupReport = {
  scanned: number;
  removed: string[];
  staleJobs: number;
};

/** Every storage path this user has recorded anywhere in the database. */
async function referencedPaths(userId: string): Promise<Set<string>> {
  const refs = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && v && !/^(https?:|blob:|data:|\/)/.test(v)) refs.add(v);
  };

  const [versions, media, scenes, clips, frames] = await Promise.all([
    supabaseAdmin.from("versions").select("before_path, after_path").limit(5000),
    supabaseAdmin
      .from("property_media_assets")
      .select("storage_path")
      .eq("user_id", userId)
      .limit(5000),
    supabaseAdmin
      .from("video_scenes")
      .select("source_path, compare_path, original_path")
      .eq("user_id", userId)
      .limit(5000),
    supabaseAdmin
      .from("scene_clips")
      .select("storage_path, source_path, thumbnail_path")
      .eq("user_id", userId)
      .limit(5000),
    supabaseAdmin
      .from("scene_start_end")
      .select("start_path, end_path, clip_path")
      .eq("user_id", userId)
      .limit(5000),
  ]);

  for (const row of versions.data ?? []) {
    add((row as Record<string, unknown>)["before_path"]);
    add((row as Record<string, unknown>)["after_path"]);
  }
  for (const row of media.data ?? []) add((row as Record<string, unknown>)["storage_path"]);
  for (const row of scenes.data ?? []) {
    add((row as Record<string, unknown>)["source_path"]);
    add((row as Record<string, unknown>)["compare_path"]);
    add((row as Record<string, unknown>)["original_path"]);
  }
  for (const row of clips.data ?? []) {
    add((row as Record<string, unknown>)["storage_path"]);
    add((row as Record<string, unknown>)["source_path"]);
    add((row as Record<string, unknown>)["thumbnail_path"]);
  }
  for (const row of frames.data ?? []) {
    add((row as Record<string, unknown>)["start_path"]);
    add((row as Record<string, unknown>)["end_path"]);
    add((row as Record<string, unknown>)["clip_path"]);
  }
  return refs;
}

export async function cleanupAbandonedUploads(
  userId: string,
  opts?: { dryRun?: boolean; graceMs?: number },
): Promise<CleanupReport> {
  const grace = opts?.graceMs ?? GRACE_MS;
  const cutoff = Date.now() - grace;
  const refs = await referencedPaths(userId);
  const removed: string[] = [];
  let scanned = 0;

  for (const bucket of ["room-photos", "reveal-videos", "user-audio"] as const) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(userId, { limit: 1000 });
    if (error) continue;
    const orphans: string[] = [];
    for (const obj of data ?? []) {
      if (!obj.name || obj.id === null) continue; // folder entry
      scanned += 1;
      const path = `${userId}/${obj.name}`;
      const created = Date.parse(obj.created_at ?? "") || 0;
      if (created > cutoff) continue; // still inside the grace window
      if (refs.has(path)) continue; // referenced by a row — never remove
      orphans.push(path);
    }
    if (orphans.length && !opts?.dryRun) {
      await supabaseAdmin.storage.from(bucket).remove(orphans);
    }
    removed.push(...orphans);
  }

  // Render jobs that never reported back are failed, not running.
  const staleBefore = new Date(cutoff).toISOString();
  const { data: jobs } = await supabaseAdmin
    .from("video_render_jobs")
    .update({ status: "failed" } as never)
    .eq("user_id", userId)
    .in("status", ["queued", "running"])
    .lt("updated_at", staleBefore)
    .select("id");

  return { scanned, removed, staleJobs: jobs?.length ?? 0 };
}
