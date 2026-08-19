/**
 * AI job persistence and stuck-job sweeping. Server-only.
 */

import { redactText } from "./redact";
import { EXPECTED_MS, canTransition, isStuck, type JobKind, type JobState } from "./jobs";

export interface JobRow {
  id: string;
  workspace_id: string;
  kind: JobKind;
  state: JobState;
  correlation_id: string;
  started_at: string;
  expected_ms: number;
  provider: string | null;
  code: string | null;
}

export async function startJob(input: {
  workspaceId: string;
  kind: JobKind;
  correlationId: string;
  provider?: string;
  idempotencyKey?: string;
}): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("ops_jobs")
    .insert({
      workspace_id: input.workspaceId,
      kind: input.kind,
      state: "queued",
      correlation_id: input.correlationId,
      expected_ms: EXPECTED_MS[input.kind],
      provider: input.provider ?? null,
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not record job: ${error.code ?? "insert_failed"}`);
  return String(data.id);
}

export async function setJobState(
  jobId: string,
  next: JobState,
  opts: { code?: string; note?: string } = {},
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("ops_jobs").select("state").eq("id", jobId).maybeSingle();
  const current = (data?.state as JobState | undefined) ?? "queued";
  if (!canTransition(current, next)) return false;
  await supabaseAdmin
    .from("ops_jobs")
    .update({
      state: next,
      code: opts.code ?? null,
      note: opts.note ? redactText(opts.note).slice(0, 300) : null,
      ...(next === "running" ? { started_at: new Date().toISOString() } : {}),
      ...(next !== "running" ? { finished_at: new Date().toISOString() } : {}),
    })
    .eq("id", jobId);
  return true;
}

/**
 * Mark jobs that ran past twice their expected duration as timed out. Safe to
 * run repeatedly: transitions are guarded and refunds are keyed by job.
 */
export async function sweepStuckJobs(now = Date.now()): Promise<JobRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ops_jobs")
    .select("id, workspace_id, kind, state, correlation_id, started_at, expected_ms, provider, code")
    .in("state", ["queued", "running"])
    .limit(200);
  const rows = (data ?? []) as unknown as JobRow[];
  const stuck = rows.filter((r) =>
    isStuck({ kind: r.kind, state: r.state, startedAt: new Date(r.started_at).getTime() }, now),
  );
  for (const row of stuck) {
    await setJobState(row.id, "timed_out", { code: "timeout" });
  }
  return stuck;
}
