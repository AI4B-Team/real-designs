import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  StartSceneClipInput,
  ClipIdInput,
  ProjectClipsInput,
  SelectClipInput,
} from "@/lib/scene-clips.schemas";

/**
 * Per-scene AI Animate. Every function is authenticated, verifies that the
 * project, the scene and the source photo belong to the caller, and derives
 * the prompt, price and storage path server-side.
 */

export const startSceneClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartSceneClipInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertClipOwnership } = await import("@/lib/scene-clips.guards.server");
    await assertClipOwnership(context.supabase, context.userId, {
      video_project_id: data.video_project_id,
      scene_id: data.scene_id ?? null,
      source_path: data.source_path,
    });
    const { createAndStartClip, clipSignedUrl } = await import("@/lib/scene-clips.server");
    const clip = await createAndStartClip(context.userId, {
      video_project_id: data.video_project_id,
      scene_key: data.scene_key,
      scene_id: data.scene_id ?? null,
      animate_id: data.animate_id,
      source_path: data.source_path,
      source_version: data.source_version,
      orientation: data.orientation,
      room_name: data.room_name ?? null,
      style: data.style ?? null,
      idempotency_key: data.idempotency_key,
    });
    return { clip, url: await clipSignedUrl(clip.storage_path) };
  });

export const getSceneClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClipIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("scene_clips")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That clip is no longer available.");
    const { reconcileClip, clipSignedUrl } = await import("@/lib/scene-clips.server");
    const clip = await reconcileClip(row as any);
    return { clip, url: await clipSignedUrl(clip.storage_path) };
  });

export const listProjectSceneClips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProjectClipsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { reconcileUserClips, clipSignedUrl } = await import("@/lib/scene-clips.server");
    if (data.reconcile) await reconcileUserClips(context.userId, data.video_project_id);
    const { data: rows, error } = await context.supabase
      .from("scene_clips")
      .select("*")
      .eq("video_project_id", data.video_project_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const clips = (rows ?? []) as any[];
    const urls: Record<string, string | null> = {};
    for (const c of clips) {
      if (c.status === "completed" && c.storage_path)
        urls[c.id] = await clipSignedUrl(c.storage_path);
    }
    return { clips, urls };
  });

/** Reconcile every active job for the signed-in user (Media / project load). */
export const reconcileSceneClips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { reconcileUserClips } = await import("@/lib/scene-clips.server");
    const clips = await reconcileUserClips(context.userId, null);
    return { clips };
  });

/** Retry is a brand new generation: it creates a new row and a new charge. */
export const retrySceneClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClipIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("scene_clips")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That clip is no longer available.");
    const prev = row as any;
    const { createAndStartClip, clipSignedUrl } = await import("@/lib/scene-clips.server");
    const clip = await createAndStartClip(context.userId, {
      video_project_id: prev.video_project_id,
      scene_key: prev.scene_key,
      scene_id: prev.scene_id,
      animate_id: prev.animate_id,
      source_path: prev.source_path,
      source_version: prev.source_version,
      orientation: prev.orientation,
      room_name: prev.room_name,
      style: null,
      idempotency_key: `retry-${prev.id}-${Number(prev.retry_count || 0) + 1}`,
    });
    await context.supabase
      .from("scene_clips")
      .update({ retry_count: Number(prev.retry_count || 0) + 1 })
      .eq("id", prev.id);
    return { clip, url: await clipSignedUrl(clip.storage_path) };
  });

/** Cancelling an unfinished job releases its credits exactly once. */
export const cancelSceneClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClipIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("scene_clips")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That clip is no longer available.");
    const clip = row as any;
    if (clip.status === "completed") throw new Error("That clip has already finished generating.");
    const { refundClipOnce, patchClip } = await import("@/lib/scene-clips.server");
    await refundClipOnce(clip, `AI clip cancelled ${clip.id}`);
    const updated = await patchClip(clip.id, {
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    });
    return { clip: updated };
  });

/**
 * Approval. A finished clip is never used in the video until the user says so,
 * and reverting to the photo keeps the clip for later reuse.
 */
export const selectSceneClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SelectClipInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("scene_clips")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That clip is no longer available.");
    const clip = row as any;
    if (data.use && (clip.status !== "completed" || !clip.storage_path))
      throw new Error("That clip has not finished generating yet.");

    const { patchClip, clipSignedUrl } = await import("@/lib/scene-clips.server");
    const updated = await patchClip(clip.id, {
      approved: data.use,
      approved_at: data.use ? new Date().toISOString() : null,
    });

    // Mirror the decision onto any persisted scene rows for this photo.
    if (clip.video_project_id && clip.scene_key) {
      await context.supabase
        .from("video_scenes")
        .update({
          clip_id: data.use ? clip.id : null,
          use_clip: data.use,
          animate_id: clip.animate_id,
          enhancement_level: data.use ? "animate" : "motion",
        })
        .eq("video_project_id", clip.video_project_id)
        .eq("source_path", clip.scene_key);
    }

    return { clip: updated, url: await clipSignedUrl(updated.storage_path) };
  });

export const deleteSceneClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ClipIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("scene_clips")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true };
    const clip = row as any;
    if (clip.status === "queued" || clip.status === "processing")
      throw new Error("Cancel this clip before deleting it.");
    const { removeClipObject } = await import("@/lib/scene-clips.guards.server");
    await removeClipObject(clip.storage_path);
    await context.supabase.from("scene_clips").delete().eq("id", clip.id);
    if (clip.video_project_id && clip.scene_key) {
      await context.supabase
        .from("video_scenes")
        .update({ clip_id: null, use_clip: false, enhancement_level: "motion" })
        .eq("video_project_id", clip.video_project_id)
        .eq("source_path", clip.scene_key);
    }
    return { ok: true };
  });
