/**
 * Pure classification helpers for the storage diagnostic.
 *
 * Kept free of any Supabase import so they can be unit tested directly and
 * reused by the verification script. The point of the split is that "storage
 * is broken" is four very different incidents, each with a different fix:
 *
 *   bucket_missing      the bucket row does not exist            -> create it
 *   bucket_public       the bucket exists but is public          -> make private
 *   policy_failure      RLS policies for the bucket are absent   -> run migrations
 *   upload_failure      write rejected by storage                -> quota/limits/keys
 *   signed_url_failure  object written but no URL could be made  -> storage API
 */

export const REQUIRED_BUCKETS = ["room-photos", "reveal-videos", "user-audio"] as const;
export type RequiredBucket = (typeof REQUIRED_BUCKETS)[number];

/** Every access rule each bucket must have for the app to work. */
export const REQUIRED_COMMANDS = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;

export type StageKind =
  | "ok"
  | "unreachable"
  | "bucket_missing"
  | "bucket_public"
  | "policy_failure"
  | "upload_failure"
  | "signed_url_failure";

export type BucketStage = {
  bucket: string;
  kind: StageKind;
  /** Administrator-facing sentence naming the precise failure and its fix. */
  detail: string;
};

export type PolicyRow = { bucket: string; cmd: string | null };

/** Commands a bucket is missing policies for, uppercased and de-duplicated. */
export function missingCommands(bucket: string, rows: PolicyRow[]): string[] {
  const have = new Set(
    rows
      .filter((r) => r.bucket === bucket && r.cmd)
      .map((r) => String(r.cmd).toUpperCase())
      .flatMap((cmd) => (cmd === "ALL" ? [...REQUIRED_COMMANDS] : [cmd])),
  );
  return REQUIRED_COMMANDS.filter((c) => !have.has(c));
}

/**
 * Turn a raw storage error into a stage. Storage returns "Bucket not found"
 * for a missing bucket and a row-level-security message when the bucket is
 * there but the policies are not, and those two need opposite remedies.
 */
export function classifyStorageError(message: string, fallback: StageKind): StageKind {
  const m = message.toLowerCase();
  if (m.includes("bucket not found") || m.includes("does not exist")) return "bucket_missing";
  if (
    m.includes("row-level security") ||
    m.includes("row level security") ||
    m.includes("unauthorized") ||
    m.includes("permission denied")
  ) {
    return "policy_failure";
  }
  return fallback;
}

const FIXES: Record<StageKind, (bucket: string, extra?: string) => string> = {
  ok: (b) => `${b}: healthy.`,
  unreachable: (b, e) =>
    `${b}: storage API unreachable (${e}). Check the backend is running and the service role key is valid.`,
  bucket_missing: (b) =>
    `${b}: BUCKET MISSING. Create it as a PRIVATE bucket with this exact id; the storage.objects policies already in the database then apply unchanged. Creating a bucket never touches existing objects.`,
  bucket_public: (b) =>
    `${b}: BUCKET IS PUBLIC. It must be private — media is served through signed URLs only. Flip it back to private.`,
  policy_failure: (b, e) =>
    `${b}: POLICY/ACCESS FAILURE${e ? ` (${e})` : ""}. The bucket exists but the storage.objects rules for it are missing or wrong. Re-run the storage policy migration.`,
  upload_failure: (b, e) =>
    `${b}: UPLOAD FAILURE${e ? ` (${e})` : ""}. The bucket and rules exist but a write was rejected — check size/MIME limits, storage quota and the service role key.`,
  signed_url_failure: (b, e) =>
    `${b}: SIGNED URL FAILURE${e ? ` (${e})` : ""}. Files can be written but no download link could be issued, so existing media will not display.`,
};

export function stageDetail(kind: StageKind, bucket: string, extra?: string): string {
  return FIXES[kind](bucket, extra);
}

/** Short, non-technical sentence for end users. Never names infrastructure. */
export function userMessageFor(stages: BucketStage[]): string | null {
  const bad = stages.filter((s) => s.kind !== "ok" && s.kind !== "bucket_public");
  if (!bad.length) return null;
  if (bad.every((s) => s.kind === "signed_url_failure")) {
    return "Some media can't be displayed right now. Please try again shortly — our team has been notified.";
  }
  return "Uploads are temporarily unavailable. Please try again shortly — our team has been notified.";
}
