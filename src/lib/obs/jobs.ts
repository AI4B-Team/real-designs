/**
 * AI job lifecycle.
 *
 * Every metered generation (design, scope, 3D plan, video) is a job with an
 * explicit state, an expected duration and a correlation ID. Pure state rules
 * live here; persistence lives in jobs.server.ts.
 */

export type JobKind = "design" | "scope" | "plan_3d" | "video";

export type JobState = "queued" | "running" | "completed" | "failed" | "canceled" | "timed_out";

export const TERMINAL_STATES: JobState[] = ["completed", "failed", "canceled", "timed_out"];

export function isTerminal(state: JobState): boolean {
  return TERMINAL_STATES.includes(state);
}

const ALLOWED: Record<JobState, JobState[]> = {
  queued: ["running", "canceled", "failed", "timed_out"],
  running: ["completed", "failed", "canceled", "timed_out"],
  completed: [],
  failed: [],
  canceled: [],
  timed_out: [],
};

export function canTransition(from: JobState, to: JobState): boolean {
  return ALLOWED[from].includes(to);
}

/** Expected wall-clock duration per job kind, in milliseconds. */
export const EXPECTED_MS: Record<JobKind, number> = {
  design: 90_000,
  scope: 60_000,
  plan_3d: 180_000,
  video: 900_000,
};

/** A job is "stuck" once it runs past twice its expected duration. */
export const STUCK_FACTOR = 2;

export function stuckDeadline(kind: JobKind, startedAt: number): number {
  return startedAt + EXPECTED_MS[kind] * STUCK_FACTOR;
}

export function isStuck(
  job: { kind: JobKind; state: JobState; startedAt: number },
  now = Date.now(),
): boolean {
  if (isTerminal(job.state)) return false;
  return now > stuckDeadline(job.kind, job.startedAt);
}

/** Rough progress wording, no fake percentages. */
export function jobStatusMessage(kind: JobKind, state: JobState): string {
  const noun =
    kind === "design" ? "design" : kind === "video" ? "video" : kind === "plan_3d" ? "3D plan" : "scope";
  switch (state) {
    case "queued":
      return `Your ${noun} is queued and will start shortly.`;
    case "running":
      return `Your ${noun} is being generated. You can leave this page — we'll keep working.`;
    case "completed":
      return `Your ${noun} is ready.`;
    case "canceled":
      return `This ${noun} was canceled. No credits were kept.`;
    case "timed_out":
      return `This ${noun} took longer than expected and was stopped. Your credits were returned.`;
    default:
      return `This ${noun} did not finish. Your credits were returned — you can try again.`;
  }
}
