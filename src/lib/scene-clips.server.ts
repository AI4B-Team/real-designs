/**
 * Scene clip service — server only.
 *
 * Genuine image-to-video generation for one scene of a property video. The
 * provider job outlives the browser: everything that matters (prompt, price,
 * provider job id, status, storage path, refunds) lives in `scene_clips`, and
 * the browser is only ever a viewer of that row.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { animateOption, animatePrompt, ANIMATE_CREDITS_PER_CLIP } from "@/lib/scene-enhancement";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/videos";
export const CLIP_MODEL = "google/veo-3.1-lite";
export const CLIP_BUCKET = "reveal-videos";
const SOURCE_BUCKET = "room-photos";

export type ClipRow = {
  id: string;
  user_id: string;
  video_project_id: string;
  scene_key: string | null;
  status: string;
  progress: number | null;
  provider_job_id: string | null;
  storage_path: string | null;
  credits_charged: number;
  credits_refunded: number;
  completed_at: string | null;
  [key: string]: any;
};

function apiKey(): string {
  const k = process.env["LOVABLE_API_KEY"];
  if (!k) throw new Error("AI is not configured.");
  return k;
}

export function clipSize(orientation: string): string {
  return orientation === "portrait" ? "720x1280" : "1280x720";
}

export function clipStoragePath(userId: string, projectId: string, sceneKey: string, clipId: string): string {
  const slug = sceneKey.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(-60) || "scene";
  return `${userId}/projects/${projectId}/scenes/${slug}/clips/${clipId}.mp4`;
}

/** Price is always read from the capability model, never from the client. */
export function clipPrice(): number {
  return ANIMATE_CREDITS_PER_CLIP;
}

/** The exact image the card shows, as a data URL the provider can read. */
export async function sourceDataUrl(path: string): Promise<string> {
  if (/^data:image\//.test(path)) return path;
  if (/^https?:/.test(path)) {
    const res = await fetch(path);
    if (!res.ok) throw new Error("That photo could not be read.");
    const type = res.headers.get("content-type") || "image/jpeg";
    const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${type};base64,${b64}`;
  }
  const dl = await supabaseAdmin.storage.from(SOURCE_BUCKET).download(path);
  if (dl.error || !dl.data) throw new Error("That photo could not be read from storage.");
  const type = (dl.data as Blob).type || (path.endsWith(".png") ? "image/png" : "image/jpeg");
  const b64 = Buffer.from(await (dl.data as Blob).arrayBuffer()).toString("base64");
  return `data:${type};base64,${b64}`;
}

export function buildClipPrompt(
  animateId: string,
  ctx: { room?: string | null; style?: string | null },
): { prompt: string; seconds: number; disclosure: string } {
  const opt = animateOption(animateId);
  if (!opt) throw new Error("That animation is not available.");
  return {
    prompt: animatePrompt(animateId, { room: ctx.room ?? null, style: ctx.style ?? null }),
    seconds: opt.seconds,
    disclosure: opt.disclosure,
  };
}

/** Start the provider job. Throws with a user-safe message on refusal. */
export async function startProviderJob(input: {
  prompt: string;
  seconds: number;
  size: string;
  image: string;
}): Promise<{ id: string; status: string; progress: number }> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CLIP_MODEL,
      prompt: input.prompt,
      seconds: String(input.seconds),
      size: input.size,
      input_reference: input.image,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as any;
    if (res.status === 429)
      throw new Error(body?.message || "Another clip is still generating. Wait for it to finish, then try again.");
    if (res.status === 402) throw new Error(body?.message || "The workspace is out of AI credits for video.");
    throw new Error(body?.message || `The clip could not be started (${res.status}).`);
  }
  const job = (await res.json()) as any;
  if (!job?.id) throw new Error("The clip could not be started.");
  return { id: String(job.id), status: String(job.status || "in_progress"), progress: Number(job.progress || 0) };
}

export async function readProviderJob(jobId: string): Promise<any> {
  const res = await fetch(`${GATEWAY}/${encodeURIComponent(jobId)}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) throw new Error(`The clip job could not be read (${res.status}).`);
  return res.json();
}

async function downloadProviderClip(jobId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${GATEWAY}/${encodeURIComponent(jobId)}/content`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) throw new Error("The finished clip could not be downloaded.");
  return res.arrayBuffer();
}

/** Refund the clip's charge at most once, ever. */
export async function refundClipOnce(clip: ClipRow, note: string): Promise<boolean> {
  const charged = Number(clip.credits_charged || 0);
  if (charged <= 0) return false;
  const { data } = await supabaseAdmin
    .from("scene_clips")
    .update({ credits_refunded: charged })
    .eq("id", clip.id)
    .eq("credits_refunded", 0)
    .select("id");
  if (!data || !data.length) return false;
  const { refund } = await import("@/lib/credits.server");
  await refund(clip.user_id, charged, note);
  return true;
}

async function patch(id: string, values: Record<string, any>): Promise<ClipRow> {
  const { data, error } = await supabaseAdmin
    .from("scene_clips")
    .update({ ...values, updated_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ClipRow;
}

/**
 * Bring one clip row up to date with the provider. Safe to call repeatedly:
 * completed/failed/cancelled rows are returned untouched, and a completed job
 * is only ever downloaded and stored once.
 */
export async function reconcileClip(clip: ClipRow): Promise<ClipRow> {
  if (!clip) return clip;
  if (clip.status === "completed" || clip.status === "failed" || clip.status === "cancelled") return clip;
  if (!clip.provider_job_id) return clip;

  let job: any;
  try {
    job = await readProviderJob(clip.provider_job_id);
  } catch (err) {
    // A transient read failure must never fail the job or move credits.
    return patch(clip.id, { last_checked_at: new Date().toISOString() });
  }

  if (job?.status === "failed") {
    await refundClipOnce(clip, `AI clip failed ${clip.id}`);
    return patch(clip.id, {
      status: "failed",
      last_checked_at: new Date().toISOString(),
      error_message: String(job?.error?.message || "The clip could not be generated.").slice(0, 400),
    });
  }

  if (job?.status !== "completed") {
    return patch(clip.id, {
      status: "processing",
      progress: Math.max(0, Math.min(100, Number(job?.progress || clip.progress || 0))),
      last_checked_at: new Date().toISOString(),
    });
  }

  // Completed: store the MP4 privately before the provider URL expires.
  const path = clip.storage_path || clipStoragePath(clip.user_id, clip.video_project_id, clip.scene_key || clip.id, clip.id);
  const exists = await supabaseAdmin.storage.from(CLIP_BUCKET).createSignedUrl(path, 60);
  if (!exists.data?.signedUrl) {
    const bytes = await downloadProviderClip(clip.provider_job_id);
    const up = await supabaseAdmin.storage
      .from(CLIP_BUCKET)
      .upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (up.error) throw new Error(up.error.message);
  }

  return patch(clip.id, {
    status: "completed",
    progress: 100,
    storage_path: path,
    completed_at: clip.completed_at || new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
    error_message: null,
  });
}

/** Signed URL for a stored clip, created only when the media is displayed. */
export async function clipSignedUrl(path?: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage.from(CLIP_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export { patch as patchClip };
