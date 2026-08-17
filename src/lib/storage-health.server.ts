/**
 * Storage bucket diagnostic.
 *
 * The buckets are infrastructure, not user data: when one is missing every
 * upload fails with a raw "Bucket not found" from the storage API, which tells
 * an end user nothing and an administrator almost as little. This check runs
 * server-side, logs a precise administrator message naming the missing bucket
 * and the migration that creates it, and hands the caller a short, non
 * technical sentence to show in the UI.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const REQUIRED_BUCKETS = ["room-photos", "reveal-videos", "user-audio"] as const;

export type StorageHealth = {
  ok: boolean;
  /** Safe to show to any signed-in user. Never names infrastructure. */
  userMessage: string | null;
  /** Administrator detail — logged and returned to admins only. */
  adminMessage: string | null;
  missing: string[];
  publicBuckets: string[];
};

const HEALTHY: StorageHealth = { ok: true, userMessage: null, adminMessage: null, missing: [], publicBuckets: [] };

/* A healthy result is cached briefly so the check can sit in front of upload
   paths without adding a round trip to every request. Failures are not cached,
   so the very next request picks up a repaired environment. */
let cached: { at: number; value: StorageHealth } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function checkStorageHealth(force = false): Promise<StorageHealth> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const { data, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    const admin = `Storage is unreachable: ${error.message}. Verify the backend is running and the service role key is valid.`;
    console.error("[storage-health] " + admin);
    return { ok: false, userMessage: genericFailure(), adminMessage: admin, missing: [], publicBuckets: [] };
  }

  const byId = new Map((data ?? []).map((b) => [b.id, b]));
  const missing = REQUIRED_BUCKETS.filter((b) => !byId.has(b));
  /* These buckets hold private client property media; a public one is a
     misconfiguration worth reporting even though it does not break uploads. */
  const publicBuckets = REQUIRED_BUCKETS.filter((b) => byId.get(b)?.public === true);

  if (!missing.length && !publicBuckets.length) {
    cached = { at: Date.now(), value: HEALTHY };
    return HEALTHY;
  }

  const parts: string[] = [];
  if (missing.length) {
    parts.push(
      `Missing required storage bucket(s): ${missing.join(", ")}. ` +
        `Create each one as a PRIVATE bucket with the same id; the storage.objects policies already in the ` +
        `database then apply unchanged. Creating a bucket never touches objects that already exist.`,
    );
  }
  if (publicBuckets.length) {
    parts.push(`Bucket(s) ${publicBuckets.join(", ")} are PUBLIC but must be private; property media is served through signed URLs only.`);
  }
  const adminMessage = parts.join(" ");
  console.error("[storage-health] " + adminMessage);

  return { ok: false, userMessage: missing.length ? genericFailure() : null, adminMessage, missing, publicBuckets };
}

function genericFailure(): string {
  return "Uploads are temporarily unavailable. Please try again shortly — our team has been notified.";
}

/** Throw the user-safe message when storage cannot accept files. */
export async function assertStorageReady(): Promise<void> {
  const health = await checkStorageHealth();
  if (!health.ok && health.missing.length) throw new Error(health.userMessage ?? genericFailure());
}
