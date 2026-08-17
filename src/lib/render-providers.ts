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
  /** Copy shown while a job of this provider is running. */
  runningNotice: string;
};

export const RENDER_PROVIDERS: Record<string, RenderProvider> = {
  browser: {
    id: "browser",
    label: "In-Browser Renderer",
    serverSide: false,
    runningNotice: "Keep this tab open while your video is created.",
  },
};

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

export function jobStatusLabel(job: { status?: string | null; progress?: number | null } | null | undefined) {
  if (!job) return "";
  if (isJobStale(job)) return "Render Interrupted";
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
