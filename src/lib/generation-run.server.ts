/**
 * Canonical generation transaction. Server-only.
 *
 * Every chargeable generation entry point (Redesign, Stage, Declutter,
 * Materials, Object Edit, Generative Edit, Day To Dusk, Sketch, Angles,
 * Floorplan, image to video, listing video, batch photos) runs through
 * runGeneration. It owns, in one place:
 *
 *   1. the idempotency claim, derived from stable request identity
 *   2. the job record and its explicit stage
 *   3. the credit charge, its state and its single refund
 *   4. the result hand-back, including replay for a duplicate request
 *
 * The guarantee: one explicit user request produces at most one job, at most
 * one charge and at most one durable result. Double clicks, browser retries,
 * timeouts, refreshes and route changes replay the first attempt instead of
 * starting a second one.
 */

import { claim, fingerprint, idempotencyKey, release } from "@/lib/obs/idempotency.server";
import type { CreditAction } from "@/lib/credits.server";

/* ------------------------------------------------------------------ states */

/** Job lifecycle. Stages are explicit; nothing is inferred from a percentage. */
export type JobStage =
  | "draft"
  | "validating"
  | "queued"
  | "processing"
  | "finalizing"
  | "succeeded"
  | "partially_succeeded"
  | "failed"
  | "cancelled";

/** Credit lifecycle, tracked separately from the job stage. */
export type CreditState =
  | "not_required"
  | "pending"
  | "reserved"
  | "charged"
  | "released"
  | "refunded"
  | "disputed";

export const TERMINAL_STAGES: JobStage[] = [
  "succeeded",
  "partially_succeeded",
  "failed",
  "cancelled",
];

/** Human, indeterminate wording for a stage. Never a fake percentage. */
export function stageMessage(stage: JobStage): string {
  switch (stage) {
    case "draft":
      return "Preparing Your Request";
    case "validating":
      return "Checking Your Photo And Settings";
    case "queued":
      return "Queued";
    case "processing":
      return "Designing Your Space";
    case "finalizing":
      return "Saving Your Result";
    case "succeeded":
      return "Done";
    case "partially_succeeded":
      return "Finished With Some Failures";
    case "failed":
      return "Failed";
    default:
      return "Cancelled";
  }
}

/** A repeat of a request that is still running. Never charged again. */
export class DuplicateRequestError extends Error {
  readonly jobId: string | null;
  readonly idempotencyKey: string;
  constructor(key: string, jobId: string | null) {
    super("That generation is already running. It will appear here when it finishes.");
    this.name = "DuplicateRequestError";
    this.idempotencyKey = key;
    this.jobId = jobId;
  }
}

/* -------------------------------------------------------------------- deps */

type Record_ = {
  key: string;
  state: string;
  job_id: string | null;
  result: unknown;
  credit_state: string | null;
  charged: number | null;
};

export type RecordPatch = {
  state?: string;
  job_id?: string;
  result?: unknown;
  credit_state?: string;
  charged?: number;
};

export interface RunDeps {
  claim: typeof claim;
  release: typeof release;
  readRecord(key: string): Promise<Record_ | null>;
  saveRecord(key: string, patch: RecordPatch): Promise<void>;
  startJob(input: {
    workspaceId: string;
    kind: string;
    correlationId: string;
    idempotencyKey: string;
  }): Promise<string>;
  setJobStage(jobId: string, stage: JobStage, note?: string): Promise<void>;
  charge: (
    userId: string,
    action: CreditAction,
    note?: string,
  ) => Promise<
    | { ok: true; charged: number; balance: number; remainingToday?: number }
    | { ok: false; reason: string; cost: number; balance?: number }
  >;
  refund: (userId: string, amount: number, note?: string) => Promise<void>;
  chargeErrorMessage: (r: { reason: string; cost: number; balance?: number }) => string;
  sleep(ms: number): Promise<void>;
  /** How long a duplicate caller waits for the first attempt to finish. */
  waitMs: number;
}

async function defaultDeps(): Promise<RunDeps> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { charge, refund, chargeErrorMessage } = await import("@/lib/credits.server");
  const { startJob, setJobState } = await import("@/lib/obs/jobs.server");

  /* ops_jobs keeps its own coarse state machine; the fine-grained stage is
     recorded on the note so no existing consumer changes shape. */
  const JOB_STATE: Record<JobStage, string> = {
    draft: "queued",
    validating: "queued",
    queued: "queued",
    processing: "running",
    finalizing: "running",
    succeeded: "succeeded",
    partially_succeeded: "succeeded",
    failed: "failed",
    cancelled: "cancelled",
  };

  return {
    claim,
    release,
    async readRecord(key) {
      const { data } = await supabaseAdmin
        .from("ops_idempotency")
        .select("key, state, job_id, result, credit_state, charged")
        .eq("key", key)
        .maybeSingle();
      return (data as unknown as Record_ | null) ?? null;
    },
    async saveRecord(key, patch) {
      await supabaseAdmin
        .from("ops_idempotency")
        .update(patch as never)
        .eq("key", key);
    },
    startJob: (input) =>
      startJob({
        workspaceId: input.workspaceId,
        kind: input.kind as never,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
      }),
    async setJobStage(jobId, stage, note) {
      await setJobState(jobId, JOB_STATE[stage] as never, note ? { note } : {});
    },
    charge,
    refund,
    chargeErrorMessage: (r) => chargeErrorMessage(r as never),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    waitMs: 25_000,
  };
}

/* --------------------------------------------------------------------- run */

export interface GenerationRequest {
  userId: string;
  /** Credit action, or null when the work is free. */
  action: CreditAction | null;
  /** Job kind, e.g. "design.render". */
  kind: string;
  /** Stable identity of the request: same inputs must produce the same parts. */
  parts: Array<string | number | null | undefined>;
  /** Optional client-supplied request id, reused across retries of one click. */
  requestId?: string | null;
  note?: string;
  /** Skip storing the result for replay (very large payloads). */
  replayable?: boolean;
}

export interface RunContext {
  jobId: string;
  key: string;
  charged: number;
  balance: number;
  remainingToday: number | null;
  /** Move the job forward; safe to call as often as the work has news. */
  stage(next: JobStage, note?: string): Promise<void>;
}

export type RunResult<T> = T & {
  job_id: string;
  stage: JobStage;
  credit_state: CreditState;
  idempotency_key: string;
  credits_charged: number;
  credits_balance: number;
  credits_remaining_today: number | null;
  replayed?: boolean;
};

const MAX_REPLAY_BYTES = 5_000_000;

export async function runGeneration<T extends object>(
  req: GenerationRequest,
  work: (ctx: RunContext) => Promise<T>,
  injected?: Partial<RunDeps>,
): Promise<RunResult<T>> {
  const deps: RunDeps = { ...(await defaultDeps()), ...(injected ?? {}) };

  const fp = await fingerprint([...req.parts, req.requestId ?? ""]);
  const key = idempotencyKey(req.userId, req.kind, fp);
  const correlationId = `${req.kind}:${fp}`;

  let claimed = await deps.claim(key, correlationId);

  if (!claimed.claimed) {
    const existing = await deps.readRecord(key);
    /* A finished attempt replays its own result: never a second charge. */
    if (existing?.state === "done" && existing.result) {
      return {
        ...(existing.result as T),
        job_id: String(existing.job_id ?? ""),
        stage: "succeeded" as JobStage,
        credit_state: (existing.credit_state as CreditState) ?? "charged",
        idempotency_key: key,
        credits_charged: existing.charged ?? 0,
        credits_balance: 0,
        credits_remaining_today: null,
        replayed: true,
      };
    }
    /* A failed attempt was already refunded, so retrying is safe. */
    if (existing?.state === "failed") {
      await deps.release(key);
      claimed = await deps.claim(key, correlationId);
    } else {
      /* Still running: wait for it rather than starting a second one. */
      const deadline = Date.now() + deps.waitMs;
      while (Date.now() < deadline) {
        await deps.sleep(500);
        const row = await deps.readRecord(key);
        if (row?.state === "done" && row.result) {
          return {
            ...(row.result as T),
            job_id: String(row.job_id ?? ""),
            stage: "succeeded" as JobStage,
            credit_state: (row.credit_state as CreditState) ?? "charged",
            idempotency_key: key,
            credits_charged: row.charged ?? 0,
            credits_balance: 0,
            credits_remaining_today: null,
            replayed: true,
          };
        }
        if (row?.state === "failed") break;
      }
      throw new DuplicateRequestError(key, (await deps.readRecord(key))?.job_id ?? null);
    }
  }

  if (!claimed.claimed) throw new DuplicateRequestError(key, claimed.jobId);

  /* ------------------------------------------------------- job and charge */

  const jobId = await deps.startJob({
    workspaceId: req.userId,
    kind: req.kind,
    correlationId,
    idempotencyKey: key,
  });
  await deps.saveRecord(key, { job_id: jobId, credit_state: "pending" });

  let creditState: CreditState = req.action ? "pending" : "not_required";
  let charged = 0;
  let balance = 0;
  let remainingToday: number | null = null;

  if (req.action) {
    const result = await deps.charge(req.userId, req.action, `${req.note ?? req.kind} [${jobId}]`);
    if (!result.ok) {
      creditState = "released";
      await deps.setJobStage(jobId, "failed", "insufficient credits");
      await deps.saveRecord(key, { state: "failed", credit_state: creditState });
      await deps.release(key);
      throw new Error(deps.chargeErrorMessage(result));
    }
    charged = result.charged;
    balance = result.balance;
    remainingToday = result.remainingToday ?? null;
    creditState = "charged";
    await deps.saveRecord(key, { credit_state: creditState, charged });
  }

  /* --------------------------------------------------------------- do work */

  const ctx: RunContext = {
    jobId,
    key,
    charged,
    balance,
    remainingToday,
    stage: (next, note) => deps.setJobStage(jobId, next, note),
  };

  try {
    await ctx.stage("processing");
    const result = await work(ctx);
    await ctx.stage("finalizing");

    /* Only now is the work successful: the caller has already stored the file
       and persisted its record before returning. */
    let replay: unknown = null;
    if (req.replayable !== false) {
      try {
        const encoded = JSON.stringify(result);
        if (encoded.length <= MAX_REPLAY_BYTES) replay = JSON.parse(encoded);
      } catch {
        /* Unserializable results simply are not replayed. */
      }
    }
    await deps.saveRecord(key, { state: "done", result: replay, credit_state: creditState });
    await deps.setJobStage(jobId, "succeeded");

    return {
      ...result,
      job_id: jobId,
      stage: "succeeded" as JobStage,
      credit_state: creditState,
      idempotency_key: key,
      credits_charged: charged,
      credits_balance: balance,
      credits_remaining_today: remainingToday,
    };
  } catch (err) {
    /* One refund, ever, for this key: the record is marked before the key is
       released, so a retry starts a fresh, separately-charged attempt. */
    if (req.action && creditState === "charged") {
      await deps.refund(req.userId, charged, `${req.note ?? req.kind} failed [${jobId}]`);
      creditState = charged > 0 ? "refunded" : "released";
    }
    const message = err instanceof Error ? err.message : String(err);
    await deps.saveRecord(key, { state: "failed", credit_state: creditState });
    await deps.setJobStage(jobId, "failed", message);
    await deps.release(key);
    throw err;
  }
}

/* ------------------------------------------------------------ batch items */

export type ItemOutcome<T> =
  | { ok: true; value: T; charged: number; balance: number; remainingToday: number | null; jobId: string }
  | { ok: false; blocked: boolean; error: string };

/**
 * One item of a multi-output request: same guarantees as runGeneration, but a
 * failure is returned instead of thrown so one bad photo never destroys the
 * results that already succeeded.
 *
 * `blocked` means the credit charge itself was refused (out of credits, daily
 * limit, plan) — the caller stops the batch. Anything else is a per-item
 * failure that leaves the rest of the batch running.
 */
export async function runGenerationItem<T>(
  req: GenerationRequest,
  work: (ctx: RunContext) => Promise<T>,
  injected?: Partial<RunDeps>,
): Promise<ItemOutcome<T>> {
  try {
    const out = await runGeneration<{ value: T }>(
      req,
      async (ctx) => ({ value: await work(ctx) }),
      injected,
    );
    return {
      ok: true,
      value: out.value,
      charged: out.credits_charged,
      balance: out.credits_balance,
      remainingToday: out.credits_remaining_today,
      jobId: out.job_id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, blocked: isCreditRefusal(message), error: message };
  }
}

export function isCreditRefusal(message: string): boolean {
  return /free designs for today|needs a paid plan|Not enough credits/i.test(message);
}
