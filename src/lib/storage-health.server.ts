/**
 * Storage bucket diagnostic.
 *
 * The buckets are infrastructure, not user data: when one is missing every
 * upload fails with a raw "Bucket not found" from the storage API, which tells
 * an end user nothing and an administrator almost as little. This check runs
 * server-side and reports one stage per bucket so an operator can tell the
 * four incidents apart:
 *
 *   bucket missing | policy/access failure | upload failure | signed URL failure
 *
 * The deep probe writes a few bytes to "_healthcheck/<uuid>" inside the bucket
 * and removes it again; it never reads, rewrites or deletes stored user files.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  REQUIRED_BUCKETS,
  classifyStorageError,
  missingCommands,
  stageDetail,
  userMessageFor,
  type BucketStage,
  type PolicyRow,
} from "@/lib/storage-health-stages";

export { REQUIRED_BUCKETS };

export type StorageHealth = {
  ok: boolean;
  /** Safe to show to any signed-in user. Never names infrastructure. */
  userMessage: string | null;
  /** Administrator detail — logged and returned to admins only. */
  adminMessage: string | null;
  missing: string[];
  publicBuckets: string[];
  /** One entry per required bucket, naming the precise failing stage. */
  stages: BucketStage[];
};

/* A healthy result is cached briefly so the check can sit in front of upload
   paths without adding a round trip to every request. Failures are not cached,
   so the very next request picks up a repaired environment. */
let cached: { at: number; value: StorageHealth } | null = null;
const TTL_MS = 5 * 60 * 1000;

export type HealthOptions = { force?: boolean; deep?: boolean };

export async function checkStorageHealth(
  opts: boolean | HealthOptions = {},
): Promise<StorageHealth> {
  const { force = false, deep = false } = typeof opts === "boolean" ? { force: opts } : opts;
  if (!force && !deep && cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const { data, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    return finish(
      REQUIRED_BUCKETS.map((b) => ({
        bucket: b,
        kind: "unreachable" as const,
        detail: stageDetail("unreachable", b, error.message),
      })),
      false,
    );
  }

  const byId = new Map((data ?? []).map((b) => [b.id, b]));
  const policies = await loadPolicies();
  const stages: BucketStage[] = [];

  for (const bucket of REQUIRED_BUCKETS) {
    const row = byId.get(bucket);
    if (!row) {
      stages.push({
        bucket,
        kind: "bucket_missing",
        detail: stageDetail("bucket_missing", bucket),
      });
      continue;
    }
    if (row.public === true) {
      stages.push({ bucket, kind: "bucket_public", detail: stageDetail("bucket_public", bucket) });
      continue;
    }
    if (policies) {
      const gaps = missingCommands(bucket, policies);
      if (gaps.length) {
        stages.push({
          bucket,
          kind: "policy_failure",
          detail: stageDetail("policy_failure", bucket, `no ${gaps.join("/")} rule`),
        });
        continue;
      }
    }
    stages.push(
      deep ? await probe(bucket) : { bucket, kind: "ok", detail: stageDetail("ok", bucket) },
    );
  }

  return finish(stages, !deep);
}

/** Write-read-delete round trip against a disposable path inside the bucket. */
async function probe(bucket: string): Promise<BucketStage> {
  const path = `_healthcheck/${crypto.randomUUID()}.txt`;
  const body = new Blob(["ok"], { type: "text/plain" });

  const up = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, body, { contentType: "text/plain", upsert: false });
  if (up.error) {
    const kind = classifyStorageError(up.error.message, "upload_failure");
    return { bucket, kind, detail: stageDetail(kind, bucket, up.error.message) };
  }

  const signed = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60);
  await supabaseAdmin.storage.from(bucket).remove([path]);

  if (signed.error || !signed.data?.signedUrl) {
    const msg = signed.error?.message ?? "no url returned";
    return {
      bucket,
      kind: "signed_url_failure",
      detail: stageDetail("signed_url_failure", bucket, msg),
    };
  }
  return { bucket, kind: "ok", detail: stageDetail("ok", bucket) };
}

async function loadPolicies(): Promise<PolicyRow[] | null> {
  const { data, error } = await supabaseAdmin.rpc("storage_policy_report" as never);
  if (error || !Array.isArray(data)) return null; // report unavailable — skip this stage rather than guess
  return data as PolicyRow[];
}

function finish(stages: BucketStage[], cacheable: boolean): StorageHealth {
  const missing = stages.filter((s) => s.kind === "bucket_missing").map((s) => s.bucket);
  const publicBuckets = stages.filter((s) => s.kind === "bucket_public").map((s) => s.bucket);
  const bad = stages.filter((s) => s.kind !== "ok");
  const ok = bad.length === 0;
  const adminMessage = ok ? null : bad.map((s) => s.detail).join(" ");
  if (adminMessage) console.error("[storage-health] " + adminMessage);

  const value: StorageHealth = {
    ok,
    userMessage: userMessageFor(stages),
    adminMessage,
    missing,
    publicBuckets,
    stages,
  };
  if (ok && cacheable) cached = { at: Date.now(), value };
  return value;
}

/** Throw the user-safe message when storage cannot accept files. */
export async function assertStorageReady(): Promise<void> {
  const health = await checkStorageHealth();
  const blocking = health.stages.some(
    (s) => s.kind === "bucket_missing" || s.kind === "policy_failure" || s.kind === "unreachable",
  );
  if (blocking)
    throw new Error(
      health.userMessage ?? "Uploads are temporarily unavailable. Please try again shortly.",
    );
}
