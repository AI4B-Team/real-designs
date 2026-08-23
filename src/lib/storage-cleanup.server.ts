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

/**
 * Every storage path this user still needs. Delegated to the canonical
 * reference index so cleanup and the orphan diagnostic can never disagree
 * about what is referenced.
 */
async function referencedPaths(userId: string): Promise<Set<string>> {
  const { buildReferenceIndex } = await import("./lineage.server");
  const index = await buildReferenceIndex(supabaseAdmin as never, userId);
  if (index.incomplete.length) {
    /* An incomplete index would make referenced files look unreferenced, so
       cleanup stops rather than deleting on a partial picture. */
    throw new Error("Couldn't read every reference, so no files were removed.");
  }
  return index.paths;
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
