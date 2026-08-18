/**
 * Start / End generation service — server only.
 *
 * A Start/End clip is a real background job: the row in `scene_start_end`
 * holds the configuration and the mirrored job state, and the generated media
 * lives on a `scene_clips` row so the renderer, Media and the credit ledger all
 * see it exactly like any other generated clip.
 *
 * Credits are charged once, before the provider is called, and released again
 * automatically if the provider refuses or the job fails.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  clipSize,
  clipSignedUrl,
  sourceDataUrl,
  startProviderJob,
  reconcileClip,
  refundClipOnce,
  patchClip,
  CLIP_MODEL,
  type ClipRow,
} from "@/lib/scene-clips.server";
import { ARCHITECTURE_GUARD, NO_PEOPLE_GUARD } from "@/lib/scene-enhancement";
import { SE_CREDITS, seMotion } from "@/lib/scene-frames-presets";

export type FrameRow = Record<string, any>;

/** The full instruction sent to the provider for one Start/End clip. */
export function buildSePrompt(input: {
  motion_preset: string;
  prompt?: string | null;
  room?: string | null;
  end_room?: string | null;
}): string {
  const m = seMotion(input.motion_preset);
  const where = input.room ? ` The shot starts in the ${input.room}.` : "";
  const ends = input.end_room ? ` It finishes on the ${input.end_room}.` : "";
  const extra = input.prompt ? ` ${String(input.prompt).slice(0, 400)}` : "";
  return [m.prompt + where + ends + extra, ARCHITECTURE_GUARD, NO_PEOPLE_GUARD].join(" ").trim();
}

async function patchFrame(id: string, values: Record<string, any>): Promise<FrameRow> {
  const { data, error } = await supabaseAdmin
    .from("scene_start_end")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as FrameRow;
}

/** Start (or re-join) the generation job for one configured frame pair. */
export async function startFrameGeneration(
  userId: string,
  frame: FrameRow,
  opts: { orientation: string; room_name?: string | null; end_room?: string | null },
): Promise<{ frame: FrameRow; clip: ClipRow }> {
  if (!frame?.start_path || !frame?.end_path)
    throw new Error("Choose both a start frame and an end frame first.");

  // Already running: never start (or charge for) a second job.
  if (frame.clip_id && (frame.status === "queued" || frame.status === "processing")) {
    const { data: existing } = await supabaseAdmin
      .from("scene_clips").select("*").eq("id", frame.clip_id).maybeSingle();
    if (existing) {
      const clip = await reconcileClip(existing as ClipRow);
      return { frame: await mirrorClip(frame, clip), clip };
    }
  }

  const motion = seMotion(frame.motion_preset);
  const seconds = Number(frame.seconds || motion.seconds) || motion.seconds;
  const size = clipSize(opts.orientation === "portrait" ? "portrait" : "landscape");
  const prompt = buildSePrompt({
    motion_preset: frame.motion_preset,
    prompt: frame.prompt,
    room: opts.room_name ?? null,
    end_room: opts.end_room ?? null,
  });

  const attempt = Number(frame.credits_reserved || 0) + Date.now();
  const insert = await supabaseAdmin
    .from("scene_clips")
    .insert({
      user_id: userId,
      video_project_id: frame.video_project_id,
      scene_id: frame.scene_id ?? null,
      scene_key: frame.scene_key,
      room_name: opts.room_name ?? null,
      source_path: frame.start_path,
      source_version: "original",
      orientation: opts.orientation === "portrait" ? "portrait" : "landscape",
      animate_id: "start_end",
      prompt,
      seconds,
      size,
      provider: "veo",
      status: "queued",
      progress: 0,
      disclosure: "ai_video",
      idempotency_key: `se-${frame.id}-${attempt}`,
      provider_payload: { mode: "start_end", end_path: frame.end_path, motion: motion.id },
    })
    .select("*")
    .single();
  if (insert.error) throw new Error(insert.error.message);
  let clip = insert.data as ClipRow;

  await patchFrame(frame.id, {
    generation_mode: "ai",
    clip_id: clip.id,
    status: "queued",
    progress: 0,
    error_message: null,
    credits_reserved: SE_CREDITS,
    credit_cost: SE_CREDITS,
    aspect: size,
    seconds,
    disclosure: "ai_video",
  });

  const { charge, chargeErrorMessage } = await import("@/lib/credits.server");
  const charged = await charge(userId, "video", `Start/End clip ${clip.id}`);
  if (!charged.ok) {
    await supabaseAdmin.from("scene_clips").delete().eq("id", clip.id);
    const f = await patchFrame(frame.id, {
      status: "configured", clip_id: null, credits_reserved: 0,
      error_message: chargeErrorMessage(charged),
    });
    throw new Error(chargeErrorMessage(charged));
  }
  clip = await patchClip(clip.id, { credits_charged: charged.charged });

  try {
    const image = await sourceDataUrl(frame.start_path);
    const job = await startProviderJob({ prompt, seconds, size, image });
    clip = await patchClip(clip.id, {
      provider_job_id: job.id,
      status: "processing",
      progress: Math.max(0, Math.min(100, job.progress)),
      last_checked_at: new Date().toISOString(),
      provider_payload: { model: CLIP_MODEL, size, seconds, mode: "start_end", end_path: frame.end_path },
    });
    const f = await patchFrame(frame.id, {
      provider_job_id: job.id,
      status: "processing",
      progress: clip.progress ?? 0,
      credits_charged: charged.charged,
    });
    return { frame: f, clip };
  } catch (err) {
    // The provider refused the job: release the reservation immediately.
    await refundClipOnce(clip, `Start/End clip could not start ${clip.id}`);
    const message = String((err as Error)?.message || "The clip could not be started.").slice(0, 400);
    await patchClip(clip.id, { status: "failed", error_message: message });
    await patchFrame(frame.id, {
      status: "failed", error_message: message, credits_reserved: 0, credits_charged: 0,
    });
    throw new Error(message);
  }
}

/** Copy the clip's job state onto the frame row and adopt a finished clip. */
async function mirrorClip(frame: FrameRow, clip: ClipRow): Promise<FrameRow> {
  const status = clip.status === "cancelled" ? "canceled" : clip.status;
  const values: Record<string, any> = {
    status,
    progress: Number(clip.progress || 0),
    provider_job_id: clip.provider_job_id,
    error_message: clip.error_message ?? null,
    credits_charged: Number(clip.credits_charged || 0) - Number(clip.credits_refunded || 0),
  };
  if (clip.status === "completed" && clip.storage_path) {
    values.clip_path = clip.storage_path;
    values.credits_reserved = 0;
    // A finished Start/End clip is the scene's media: adopt it straight away.
    if (!clip.approved) {
      await patchClip(clip.id, { approved: true, approved_at: new Date().toISOString() });
      await supabaseAdmin
        .from("video_scenes")
        .update({ clip_id: clip.id, use_clip: true, animate_id: "start_end", enhancement_level: "animate" })
        .eq("video_project_id", clip.video_project_id as string)
        .eq("source_path", clip.scene_key as string);
    }
  }
  if (clip.status === "failed" || clip.status === "cancelled") values.credits_reserved = 0;
  return patchFrame(frame.id, values);
}

/**
 * Bring every unfinished Start/End job of one project up to date. Called on
 * load and while polling, so leaving the page and coming back is safe.
 */
export async function reconcileFrames(
  userId: string,
  projectId: string,
): Promise<{ frames: FrameRow[]; urls: Record<string, string | null> }> {
  const { data: rows } = await supabaseAdmin
    .from("scene_start_end")
    .select("*")
    .eq("user_id", userId)
    .eq("video_project_id", projectId);
  const frames: FrameRow[] = [];
  const urls: Record<string, string | null> = {};
  for (const raw of (rows ?? []) as FrameRow[]) {
    let f = raw;
    if (f.clip_id && (f.status === "queued" || f.status === "processing")) {
      const { data: c } = await supabaseAdmin.from("scene_clips").select("*").eq("id", f.clip_id).maybeSingle();
      if (c) {
        const clip = await reconcileClip(c as ClipRow);
        f = await mirrorClip(f, clip);
      }
    }
    if (f.clip_path) urls[f.scene_key] = await clipSignedUrl(f.clip_path);
    frames.push(f);
  }
  return { frames, urls };
}

/** Cancel an unfinished Start/End job and release its credits. */
export async function cancelFrameGeneration(frame: FrameRow): Promise<FrameRow> {
  if (frame.clip_id) {
    const { data: c } = await supabaseAdmin.from("scene_clips").select("*").eq("id", frame.clip_id).maybeSingle();
    if (c) {
      const clip = c as ClipRow;
      if (clip.status !== "completed") {
        await refundClipOnce(clip, `Start/End clip cancelled ${clip.id}`);
        await patchClip(clip.id, { status: "cancelled", cancelled_at: new Date().toISOString() });
      }
    }
  }
  return patchFrame(frame.id, {
    status: frame.clip_path ? "completed" : "canceled",
    credits_reserved: 0,
    progress: 0,
  });
}
