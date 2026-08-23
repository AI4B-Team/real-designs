/**
 * Generation job state.
 *
 * One store owns every design generation, single photo or batch, so what the
 * Canvas overlay shows, what a thumbnail shows, what the batch panel counts
 * and what a notification announces are the same facts.
 *
 * The rules that keep this honest:
 *
 * - A stage is only ever set when that stage actually starts. Nothing here
 *   advances on a timer, so a job can never claim "Finalizing" while the
 *   render request is still open.
 * - There is no percentage. Progress is reported as the real step number, and
 *   a duration estimate is only offered once enough recent jobs have finished
 *   to derive one.
 * - A batch is created once per idempotency key. A double click, a resubmit
 *   or a remount reuses the existing batch instead of charging again.
 * - Jobs are persisted. A page that reloads reconnects to its own records; a
 *   job whose page died is marked interrupted (recoverable) rather than shown
 *   as if it were still running somewhere.
 */

export type Stage =
  | "queued"
  | "analyzing"
  | "preparing"
  | "generating"
  | "finalizing"
  | "complete"
  | "failed"
  | "cancelled";

export type Job = {
  id: string;
  batchId: string;
  key: string;
  label: string;
  room: string;
  style: string;
  thumb: string | null;
  stage: Stage;
  error: string;
  /** True once a credit has actually been spent on this job. */
  charged: boolean;
  /** Set by the backend when a credit was confirmed returned. */
  creditRestored: boolean;
  resultPath: string | null;
  startedAt: number | null;
  endedAt: number | null;
  /** A job whose page went away mid-run: recoverable, never silently retried. */
  interrupted: boolean;
};

export type Batch = { id: string; key: string; createdAt: number; jobs: Job[] };

/** Ordered working stages. Terminal stages are deliberately not steps. */
export const WORK_STAGES: Stage[] = ["analyzing", "preparing", "generating", "finalizing"];
export const STEP_TOTAL = WORK_STAGES.length;

export const STAGE_TITLE: Record<Stage, string> = {
  queued: "Queued",
  analyzing: "Analyzing Space",
  preparing: "Preparing Your Design",
  generating: "Generating Design",
  finalizing: "Finalizing",
  complete: "Complete",
  failed: "Generation Failed",
  cancelled: "Cancelled",
};

/** Plain descriptions. Nothing here claims a specific object was detected. */
export const STAGE_NOTE: Record<Stage, string> = {
  queued: "Waiting for a free slot…",
  analyzing: "Reading the photo and its framing…",
  preparing: "Assembling the design brief…",
  generating: "Creating new finishes, furniture and details…",
  finalizing: "Saving your high-resolution result…",
  complete: "Your design is ready.",
  failed: "This photo did not render.",
  cancelled: "This job was cancelled.",
};

export function isTerminal(stage: Stage): boolean {
  return stage === "complete" || stage === "failed" || stage === "cancelled";
}

export function isActive(stage: Stage): boolean {
  return !isTerminal(stage);
}

/** "Step 3 of 4" for a working stage; empty for queued and terminal stages. */
export function stepText(stage: Stage): string {
  const i = WORK_STAGES.indexOf(stage);
  return i < 0 ? "" : `Step ${i + 1} of ${STEP_TOTAL}`;
}

/* ------------------------------------------------------------------ */
/* Duration estimates, derived only from real completed runs           */
/* ------------------------------------------------------------------ */

const HISTORY_KEY = "rd.gen.history.v1";
const MIN_SAMPLES = 3;

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readHistory(): number[] {
  const s = store();
  if (!s) return [];
  try {
    const raw = JSON.parse(s.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((n) => typeof n === "number" && n > 0).slice(-20) : [];
  } catch {
    return [];
  }
}

export function recordDuration(ms: number): void {
  if (!(ms > 0)) return;
  const s = store();
  if (!s) return;
  try {
    s.setItem(HISTORY_KEY, JSON.stringify(readHistory().concat(ms).slice(-20)));
  } catch {
    /* A full or blocked storage must never break a generation. */
  }
}

/**
 * A human estimate, or null when there is not enough real data. Callers must
 * never invent one: no estimate simply means no estimate line.
 */
export function historicalEstimate(): string | null {
  const h = readHistory();
  if (h.length < MIN_SAMPLES) return null;
  const sorted = h.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? sorted[0] ?? 0;
  const secs = Math.round(median / 1000);
  if (secs < 45) return `about ${Math.max(10, Math.round(secs / 5) * 5)} seconds`;
  const mins = Math.round(secs / 30) / 2;
  return `about ${mins} minute${mins === 1 ? "" : "s"}`;
}

/**
 * The second status line for a job: real step information when we have it,
 * a historical estimate when we do not, and nothing invented either way.
 */
export function progressText(job: Pick<Job, "stage">): string {
  if (job.stage === "queued") return STAGE_NOTE.queued;
  if (isTerminal(job.stage)) return "";
  const step = stepText(job.stage);
  if (step) return step;
  const est = historicalEstimate();
  return est ? `This usually takes ${est}.` : "";
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const STATE_KEY = "rd.gen.jobs.v1";
/** Identifies this page load, so a record from a dead page is recognisable. */
const SESSION = Math.random().toString(36).slice(2) + Date.now().toString(36);

type Persisted = { session: string; batches: Batch[] };

let batches: Batch[] = [];
let loaded = false;
const listeners = new Set<(b: Batch[]) => void>();

function persist(): void {
  const s = store();
  if (!s) return;
  try {
    const payload: Persisted = { session: SESSION, batches: batches.slice(-6) };
    s.setItem(STATE_KEY, JSON.stringify(payload));
  } catch {
    /* Persistence is a convenience; losing it must not stop a render. */
  }
}

/**
 * Reconnect to whatever this browser already knows.
 *
 * A record left running by a previous page load cannot be attached to, so it
 * becomes an interrupted failure with Retry — the one thing we never do is
 * quietly start the work again, which would charge a second credit.
 */
export function loadJobs(): Batch[] {
  if (loaded) return batches;
  loaded = true;
  const s = store();
  if (!s) return batches;
  try {
    const raw = JSON.parse(s.getItem(STATE_KEY) || "null") as Persisted | null;
    if (!raw || !Array.isArray(raw.batches)) return batches;
    const stale = raw.session !== SESSION;
    batches = raw.batches.map((b) => ({
      ...b,
      jobs: (b.jobs || []).map((j) =>
        stale && isActive(j.stage)
          ? {
              ...j,
              stage: "failed" as Stage,
              interrupted: true,
              error: "Generation was interrupted when the page closed.",
              endedAt: j.endedAt || Date.now(),
            }
          : j,
      ),
    }));
  } catch {
    batches = [];
  }
  return batches;
}

export function subscribe(fn: (b: Batch[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(): void {
  persist();
  listeners.forEach((fn) => {
    try {
      fn(batches);
    } catch {
      /* One bad subscriber must not stop the others. */
    }
  });
}

export function allBatches(): Batch[] {
  return loadJobs();
}

export function getBatch(id: string): Batch | null {
  return allBatches().find((b) => b.id === id) || null;
}

export function findJob(jobId: string): Job | null {
  for (const b of allBatches()) {
    const j = b.jobs.find((x) => x.id === jobId);
    if (j) return j;
  }
  return null;
}

export type JobSeed = {
  key: string;
  label?: string;
  room?: string;
  style?: string;
  thumb?: string | null;
};

/**
 * Create a batch, once. Calling again with the same idempotency key returns
 * the batch that already exists — this is what makes the Generate button safe
 * against double clicks, resubmits and remounts.
 */
export function createBatch(key: string, seeds: JobSeed[]): Batch {
  loadJobs();
  const existing = batches.find((b) => b.key === key);
  if (existing) return existing;
  const id = `b_${key}`;
  const batch: Batch = {
    id,
    key,
    createdAt: Date.now(),
    jobs: seeds.map((s, i) => ({
      id: `${id}:${s.key || i}`,
      batchId: id,
      key: s.key || String(i),
      label: s.label || `Photo ${i + 1}`,
      room: s.room || "",
      style: s.style || "",
      thumb: s.thumb || null,
      stage: "queued",
      error: "",
      charged: false,
      creditRestored: false,
      resultPath: null,
      startedAt: null,
      endedAt: null,
      interrupted: false,
    })),
  };
  batches = batches.concat(batch).slice(-6);
  emit();
  return batch;
}

function mutate(jobId: string, fn: (j: Job) => void): Job | null {
  const j = findJob(jobId);
  if (!j) return null;
  fn(j);
  emit();
  return j;
}

/** Move a job forward. Terminal jobs never move again. */
export function setStage(jobId: string, stage: Stage): Job | null {
  return mutate(jobId, (j) => {
    if (isTerminal(j.stage)) return;
    j.stage = stage;
    if (stage === "analyzing" && !j.startedAt) j.startedAt = Date.now();
    /* A credit is spent the moment the render request is issued. */
    if (stage === "generating") j.charged = true;
  });
}

export function completeJob(jobId: string, resultPath: string | null): Job | null {
  return mutate(jobId, (j) => {
    j.stage = "complete";
    j.error = "";
    j.interrupted = false;
    j.resultPath = resultPath || null;
    j.endedAt = Date.now();
    if (j.startedAt) recordDuration(j.endedAt - j.startedAt);
  });
}

export function failJob(jobId: string, message: string, opts: { creditRestored?: boolean } = {}) {
  return mutate(jobId, (j) => {
    j.stage = "failed";
    j.error = message || STAGE_NOTE.failed;
    j.endedAt = Date.now();
    if (opts.creditRestored) j.creditRestored = true;
  });
}

/** Only the backend may say a credit came back, so this is a separate call. */
export function markCreditRestored(jobId: string): Job | null {
  return mutate(jobId, (j) => {
    j.creditRestored = true;
  });
}

/**
 * Put a failed job back in the queue. A job that was already charged keeps
 * `charged`, so the retry path can tell a free retry from a paid one and can
 * never bill the same photo twice for the same failure.
 */
export function retryJob(jobId: string): Job | null {
  return mutate(jobId, (j) => {
    if (j.stage !== "failed") return;
    j.stage = "queued";
    j.error = "";
    j.interrupted = false;
    j.endedAt = null;
  });
}

/* ------------------------------------------------------------------ */
/* Summaries                                                           */
/* ------------------------------------------------------------------ */

export type Counts = {
  total: number;
  complete: number;
  generating: number;
  queued: number;
  failed: number;
  active: number;
};

export function countBatch(batch: Batch | null): Counts {
  const jobs = (batch && batch.jobs) || [];
  const complete = jobs.filter((j) => j.stage === "complete").length;
  const failed = jobs.filter((j) => j.stage === "failed" || j.stage === "cancelled").length;
  const queued = jobs.filter((j) => j.stage === "queued").length;
  const generating = jobs.length - complete - failed - queued;
  return {
    total: jobs.length,
    complete,
    generating,
    queued,
    failed,
    active: generating + queued,
  };
}

/** "1 complete · 2 generating · 1 queued" — only the parts that exist. */
export function countsText(counts: Counts): string {
  const parts: string[] = [];
  if (counts.complete) parts.push(`${counts.complete} complete`);
  if (counts.generating) parts.push(`${counts.generating} generating`);
  if (counts.queued) parts.push(`${counts.queued} queued`);
  if (counts.failed) parts.push(`${counts.failed} failed`);
  return parts.join(" · ");
}

export function batchTitle(counts: Counts): string {
  if (!counts.active && counts.total)
    return counts.failed
      ? `${counts.complete} Of ${counts.total} Designs Ready`
      : `${counts.total} Design${counts.total === 1 ? " Is" : "s Are"} Ready`;
  return `Creating ${counts.total} Design${counts.total === 1 ? "" : "s"}`;
}

/** Screen-reader sentence for a job that just reached a terminal stage. */
export function announce(job: Job): string {
  const what = (job.room || job.label || "Design").trim();
  if (job.stage === "complete") return `${what} design complete.`;
  if (job.stage === "failed") return `${what} design failed. ${job.error}`.trim();
  if (job.stage === "cancelled") return `${what} design cancelled.`;
  return `${what}: ${STAGE_TITLE[job.stage]}.`;
}

/**
 * Cancellation is not offered unless a backend can genuinely stop the work.
 * The render call is a single request that keeps running (and billing) once
 * issued, so this is false — and the UI must not draw a Cancel button.
 */
export function cancellationSupported(): boolean {
  return false;
}

/** Test seam. */
export function __resetJobs(): void {
  batches = [];
  loaded = false;
  try {
    store()?.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
}
