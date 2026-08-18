/**
 * Render provider registry.
 *
 * Today the only renderer is the browser encoder (canvas + MediaRecorder),
 * which requires the tab to stay open. The job record in `video_render_jobs`
 * is deliberately provider-agnostic so a server-side renderer (Creatomate,
 * Shotstack, Remotion Lambda, …) can be added later without changing the
 * database, the credit flow or the user-facing workflow: register it here,
 * have the server function submit to it and store its id in
 * `provider_job_id`, then poll it into the same status/progress fields.
 */

export type RenderJobStatus = "queued" | "rendering" | "completed" | "failed" | "cancelled";

export type RenderProvider = {
  id: string;
  label: string;
  /** True once rendering continues without the user's browser. */
  serverSide: boolean;
  /** True when the job survives the tab closing. Never true for the browser. */
  survivesTabClose: boolean;
  /** True when the provider reports real progress; we never fake a bar. */
  reportsProgress: boolean;
  /** Whether the provider is wired up, authenticated and usable right now. */
  configured: boolean;
  /** Copy shown while a job of this provider is running. */
  runningNotice: string;
};

export const RENDER_PROVIDERS: Record<string, RenderProvider> = {
  browser: {
    id: "browser",
    label: "In-Browser Renderer",
    serverSide: false,
    survivesTabClose: false,
    reportsProgress: true,
    configured: true,
    runningNotice: "Keep this tab open while your video is created.",
  },
};

/**
 * Registers a server-side encoder (Creatomate, Shotstack, Remotion Lambda, an
 * own ffmpeg worker …). Nothing else in the app changes: the job row, credits
 * and the UI already read from this registry. A provider is only allowed to
 * claim it survives a closed tab when it is actually server-side.
 */
export function registerRenderProvider(p: RenderProvider) {
  RENDER_PROVIDERS[p.id] = { ...p, survivesTabClose: p.serverSide && p.survivesTabClose };
  return RENDER_PROVIDERS[p.id]!;
}

/** The provider used for new jobs: the first configured server-side one, else the browser. */
export function activeRenderProvider(): RenderProvider {
  const server = Object.values(RENDER_PROVIDERS).find((p) => p.serverSide && p.configured);
  return server || RENDER_PROVIDERS[DEFAULT_RENDER_PROVIDER]!;
}

/** Honest answer to "can I close this tab?" — never guessed from wishful config. */
export function runsInBackground(id?: unknown) {
  const p = renderProvider(id ?? activeRenderProvider().id);
  return p.serverSide && p.configured && p.survivesTabClose;
}

export const DEFAULT_RENDER_PROVIDER = "browser";

export function renderProvider(id: unknown): RenderProvider {
  const key = typeof id === "string" ? id : DEFAULT_RENDER_PROVIDER;
  return RENDER_PROVIDERS[key] || RENDER_PROVIDERS[DEFAULT_RENDER_PROVIDER]!;
}

export function isProviderServerSide(id: unknown) {
  return renderProvider(id).serverSide;
}

/** A job is only "live" while its owner keeps reporting progress. */
export const RENDER_HEARTBEAT_STALE_MS = 120_000;

export function isJobStale(job: { status?: string | null; heartbeat_at?: string | null } | null | undefined) {
  if (!job || (job.status !== "queued" && job.status !== "rendering")) return false;
  const beat = job.heartbeat_at ? Date.parse(job.heartbeat_at) : 0;
  return !beat || Date.now() - beat > RENDER_HEARTBEAT_STALE_MS;
}

export type CreditRelease = { release: boolean; amount: number; reason: string };

/**
 * Credits are released once, and only for a render that ended without giving
 * the user a video: a failure, a cancellation, or a job whose browser went
 * away mid-render. Completed renders keep their charge.
 */
export function creditRelease(
  job:
    | { status?: string | null; credits_charged?: number | null; credits_refunded?: number | null }
    | null
    | undefined,
  nextStatus?: string | null,
): CreditRelease {
  const status = nextStatus || job?.status || "";
  const charged = Number(job?.credits_charged) || 0;
  const already = Number(job?.credits_refunded) || 0;
  const amount = charged - already;
  if (status !== "failed" && status !== "cancelled") return { release: false, amount: 0, reason: "not_terminal" };
  if (amount <= 0) return { release: false, amount: 0, reason: already > 0 ? "already_released" : "nothing_charged" };
  return {
    release: true,
    amount,
    reason: status === "cancelled" ? "cancelled" : "failed",
  };
}

export function jobStatusLabel(job: { status?: string | null; progress?: number | null } | null | undefined) {
  if (!job) return "";
  if (isJobStale(job)) return "Render Interrupted";
  if ((job as any).cancel_requested && (job.status === "queued" || job.status === "rendering")) return "Stopping\u2026";
  switch (job.status) {
    case "queued":
      return "Queued";
    case "rendering":
      return `Rendering ${Math.round((Number(job.progress) || 0) * 100)}%`;
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "";
  }
}
