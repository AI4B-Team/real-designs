import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Animate — durable motion-clip jobs.
 *
 * Every clip is a row in public.motion_clip_jobs before a single credit is
 * spent, so a refresh, a closed tab or a crash can never orphan a paid render:
 * the row carries the provider job id, the charge, the refund flag and the
 * stored MP4 path. Charged exactly once (an idempotency key collapses double
 * submissions), refunded exactly once (guarded by the row's refunded flag).
 */

const PayloadShape = z.object({
  clip_kind: z.enum(["single", "before_after", "angle_sequence"]),
  motion: z.string().max(30),
  motion_label: z.string().max(40),
  seconds: z.number().int().min(4).max(8),
  aspect: z.enum(["16:9", "9:16", "1:1"]),
  resolution: z.enum(["720p", "1080p"]),
  strength: z.number().min(0).max(100),
  speed: z.number().min(0).max(100),
  lock_architecture: z.boolean(),
  allow_people: z.boolean(),
  room_type: z.string().max(60).nullable(),
  style_name: z.string().max(80).nullable(),
  source_kind: z.enum(["current", "original", "version", "angle_set"]),
  source_label: z.string().max(80),
  source_path: z.string().max(300).nullable(),
  prompt: z.string().max(4000),
  negative_prompt: z.string().max(1200),
  end_card: z.boolean(),
  disclosure: z.boolean(),
  model: z.string().max(60),
});

const StartInput = z.object({
  title: z.string().max(90).default("Motion Clip"),
  idempotency_key: z.string().min(4).max(80),
  payload: PayloadShape,
  /** Storage path of the persisted source. Required — a clip never runs from an unsaved image. */
  source_path: z.string().min(3).max(300),
  /** Second frame for a before / after reveal. */
  frame_path: z.string().max(300).nullable().default(null),
  property_id: z.string().uuid().nullable().default(null),
});

const BUCKET = "room-photos";
/** A clip that has not finished in this long is never going to; release its credits. */
const STALE_CLIP_MS = 45 * 60 * 1000;

async function toDataUrl(path: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const dl = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (dl.error || !dl.data) throw new Error("The saved source image could not be opened.");
  const buf = new Uint8Array(await dl.data.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192)
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  const type = /\.png$/i.test(path) ? "image/png" : "image/jpeg";
  return `data:${type};base64,${btoa(bin)}`;
}

function shape(row: any, url: string | null = null) {
  return {
    id: String(row.id),
    title: String(row.title || "Motion Clip"),
    status: String(row.status || "queued"),
    progress: Number(row.progress || 0),
    provider_job_id: row.provider_job_id ?? null,
    output_path: row.output_path ?? null,
    thumbnail_path: row.thumbnail_path ?? null,
    url,
    error: row.error ?? null,
    credits: Number(row.credits || 0),
    refunded: !!row.refunded,
    source_path: row.source_path ?? null,
    source_label: row.source_label ?? null,
    payload: row.payload ?? null,
    check: row.quality_check ?? null,
    video_project_id: row.video_project_id ?? null,
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

/* ----------------------------------------------------------------- start */

export const startMotionClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Duplicate submission: the same settings on the same source reuse the
    // existing job. Nothing is charged twice.
    const { data: prior } = await supabase
      .from("motion_clip_jobs")
      .select("*")
      .eq("user_id", userId)
      .eq("idempotency_key", data.idempotency_key)
      .maybeSingle();
    if (prior) return { job: shape(prior), reused: true };

    const { data: row, error } = await supabase
      .from("motion_clip_jobs")
      .insert({
        user_id: userId,
        title: data.title,
        status: "queued",
        progress: 0,
        idempotency_key: data.idempotency_key,
        source_path: data.source_path,
        source_label: data.payload.source_label,
        source_kind: data.payload.source_kind,
        payload: data.payload as any,
      })
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message || "The clip could not be queued.");

    const { charge, refund, chargeErrorMessage, CREDIT_COSTS } = await import(
      "@/lib/credits.server"
    );
    const charged = await charge(userId, "video", `Motion clip ${row.id}`);
    if (!charged.ok) {
      await supabase.from("motion_clip_jobs").delete().eq("id", row.id);
      throw new Error(chargeErrorMessage(charged));
    }
    await supabase
      .from("motion_clip_jobs")
      .update({ charged: true, credits: charged.charged || CREDIT_COSTS.video })
      .eq("id", row.id);

    try {
      const { createProviderJob } = await import("@/lib/animate.server");
      const image = await toDataUrl(data.source_path);
      const lastFrame = data.frame_path ? await toDataUrl(data.frame_path) : null;
      const job = await createProviderJob({ payload: data.payload as any, image, lastFrame });
      const { data: updated } = await supabase
        .from("motion_clip_jobs")
        .update({
          provider_job_id: job.id,
          status: job.status === "completed" ? "in_progress" : "in_progress",
          progress: job.progress,
        })
        .eq("id", row.id)
        .select("*")
        .single();
      return { job: shape(updated || row), reused: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : "The clip could not be started.";
      await refund(userId, charged.charged, `Motion clip ${row.id} could not start`);
      await supabase
        .from("motion_clip_jobs")
        .update({ status: "failed", error: message, refunded: true })
        .eq("id", row.id);
      throw new Error(message);
    }
  });

/* ------------------------------------------------------------------ poll */

export const pollMotionClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("motion_clip_jobs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("That clip could not be found.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Already finished: hand back a fresh signed URL, never re-download.
    if (row.status === "completed" && row.output_path) {
      const signed = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(row.output_path, 3600);
      return { job: shape(row, signed.data?.signedUrl || null) };
    }
    if (row.status === "failed") return { job: shape(row) };
    if (!row.provider_job_id) return { job: shape(row) };

    const { readProviderJob, downloadProviderVideo } = await import("@/lib/animate.server");
    const { refund } = await import("@/lib/credits.server");

    /** End a clip that produced no video and give its credits back exactly once. */
    const failClip = async (message: string) => {
      if (!row.refunded && row.charged) {
        await refund(userId, Number(row.credits || 0), `Motion clip ${row.id} failed`);
      }
      const { data: failed } = await supabase
        .from("motion_clip_jobs")
        .update({ status: "failed", refunded: true, error: message })
        .eq("id", row.id)
        .select("*")
        .single();
      return { job: shape(failed || row) };
    };

    let job: { status: string; progress: number; error: string | null };
    try {
      job = await readProviderJob(String(row.provider_job_id));
    } catch (_) {
      // A transient read failure is not a failed render — keep waiting, unless
      // the job is so old that no video is coming; then release the credits.
      const ageMs = Date.now() - new Date(String(row.created_at)).getTime();
      if (ageMs > STALE_CLIP_MS) {
        return await failClip("The clip stopped responding before it finished.");
      }
      return { job: shape(row) };
    }

    if (job.status === "failed") {
      return await failClip(job.error || "The clip could not be generated.");
    }

    if (job.status !== "completed") {
      const ageMs = Date.now() - new Date(String(row.created_at)).getTime();
      if (ageMs > STALE_CLIP_MS) {
        return await failClip("The clip took too long and was stopped.");
      }
      if (job.progress !== Number(row.progress || 0) || row.status !== "in_progress") {
        await supabase
          .from("motion_clip_jobs")
          .update({ status: "in_progress", progress: job.progress })
          .eq("id", row.id);
      }
      return { job: shape({ ...row, status: "in_progress", progress: job.progress }) };
    }

    // Completed — store the MP4 durably before the gateway copy expires.
    const path = `${userId}/motion/${row.id}.mp4`;
    try {
      const bytes = await downloadProviderVideo(String(row.provider_job_id));
      const up = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "video/mp4", upsert: true });
      if (up.error) throw new Error(up.error.message);
    } catch (err) {
      // The provider copy expires, so a failed save means the clip is gone:
      // do not leave the user charged and waiting forever.
      const why = err instanceof Error ? err.message : "The clip could not be saved.";
      return await failClip(why);
    }


    // Make the clip appear in Media as a generated video.
    let videoProjectId: string | null = row.video_project_id ?? null;
    if (!videoProjectId) {
      const payload = (row.payload || {}) as any;
      const { data: project } = await supabase
        .from("video_projects")
        .insert({
          user_id: userId,
          title: row.title || "Motion Clip",
          status: "ready",
          video_type: "motion_clip",
          source_type: "design",
          motion: String(payload.motion || "dolly_in"),
          settings: payload,
        })
        .select("id")
        .single();
      videoProjectId = project?.id ?? null;
      if (videoProjectId) {
        await supabase.from("video_variants").insert({
          user_id: userId,
          video_project_id: videoProjectId,
          aspect_ratio: String(payload.aspect || "16:9"),
          version_type: payload.disclosure ? "disclosure" : "clean",
          render_status: "ready",
          output_path: path,
          duration: Number(payload.seconds || 8),
          resolution: String(payload.resolution || "720p"),
          credit_cost: Number(row.credits || 0),
        });
      }
    }

    const { data: done } = await supabase
      .from("motion_clip_jobs")
      .update({
        status: "completed",
        progress: 100,
        output_path: path,
        video_project_id: videoProjectId,
        error: null,
      })
      .eq("id", row.id)
      .select("*")
      .single();

    const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 3600);
    return { job: shape(done || row, signed.data?.signedUrl || null) };
  });

/* ------------------------------------------------------------------ list */

export const listMotionClips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ limit: z.number().int().min(1).max(50).default(20) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("motion_clip_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const jobs = await Promise.all(
      (rows || []).map(async (r: any) => {
        if (r.status !== "completed" || !r.output_path) return shape(r);
        const signed = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(r.output_path, 3600);
        return shape(r, signed.data?.signedUrl || null);
      }),
    );
    return { jobs };
  });

/* --------------------------------------------------------- rename/delete */

export const updateMotionClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(90) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("motion_clip_jobs")
      .update({ title: data.title })
      .eq("id", data.id)
      .select("video_project_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row?.video_project_id)
      await context.supabase
        .from("video_projects")
        .update({ title: data.title })
        .eq("id", row.video_project_id);
    return { ok: true };
  });

export const deleteMotionClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("motion_clip_jobs")
      .select("output_path, video_project_id")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.output_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from(BUCKET).remove([row.output_path]);
    }
    if (row?.video_project_id)
      await context.supabase.from("video_projects").delete().eq("id", row.video_project_id);
    const { error } = await context.supabase.from("motion_clip_jobs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------------------------------------- quality check */

export const checkMotionClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), end_frame: z.string().min(16).max(12_000_000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("motion_clip_jobs")
      .select("id, source_path, quality_check")
      .eq("id", data.id)
      .maybeSingle();
    if (!row?.source_path) throw new Error("That clip could not be found.");
    if (row.quality_check) return { check: row.quality_check };

    const source = await toDataUrl(row.source_path);
    const { checkMotion } = await import("@/lib/animate.server");
    const check = await checkMotion(source, data.end_frame);
    await supabase
      .from("motion_clip_jobs")
      .update({ quality_check: check as any })
      .eq("id", row.id);
    return { check };
  });
