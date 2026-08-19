/**
 * Duplicate protection for metered work. Server-only.
 *
 * A generation is keyed by (workspace, action, input fingerprint). The first
 * caller claims the key and does the work; a concurrent or repeated caller gets
 * the existing claim back and is never charged a second time.
 */

import { redactText } from "./redact";

export type ClaimResult =
  | { claimed: true; key: string; correlationId: string }
  | { claimed: false; key: string; correlationId: string; jobId: string | null; state: string };

/** Stable fingerprint of the inputs that define one generation. */
export async function fingerprint(
  parts: Array<string | number | null | undefined>,
): Promise<string> {
  const input = parts.map((p) => String(p ?? "")).join("|");
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function idempotencyKey(workspaceId: string, action: string, fp: string): string {
  return `${workspaceId}:${action}:${fp}`;
}

/** Claim the key. Returns claimed:false when the same work is already under way. */
export async function claim(
  key: string,
  correlationId: string,
  ttlMinutes = 60,
): Promise<ClaimResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const expires = new Date(Date.now() + ttlMinutes * 60_000).toISOString();

  const { error } = await supabaseAdmin
    .from("ops_idempotency")
    .insert({ key, correlation_id: correlationId, expires_at: expires, state: "in_progress" });

  if (!error) return { claimed: true, key, correlationId };

  // Unique violation -> someone already owns this key (or an expired row remains).
  const { data } = await supabaseAdmin
    .from("ops_idempotency")
    .select("correlation_id, job_id, state, expires_at")
    .eq("key", key)
    .maybeSingle();

  if (data && new Date(String(data.expires_at)).getTime() < Date.now()) {
    await supabaseAdmin
      .from("ops_idempotency")
      .update({
        correlation_id: correlationId,
        state: "in_progress",
        job_id: null,
        expires_at: expires,
      })
      .eq("key", key);
    return { claimed: true, key, correlationId };
  }

  return {
    claimed: false,
    key,
    correlationId: String(data?.correlation_id ?? correlationId),
    jobId: (data?.job_id as string | null) ?? null,
    state: String(data?.state ?? "in_progress"),
  };
}

export async function attachJob(key: string, jobId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ops_idempotency").update({ job_id: jobId }).eq("key", key);
}

export async function settle(key: string, state: "done" | "failed", note?: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("ops_idempotency")
    .update({ state, note: note ? redactText(note).slice(0, 300) : null })
    .eq("key", key);
}

/** Release a key immediately so a failed attempt can be retried by the user. */
export async function release(key: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ops_idempotency").delete().eq("key", key);
}
