import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Start / End persistence and generation.
 *
 * The frame pair is durable data, not builder state: it lives in
 * `scene_start_end`, keyed by the project plus the scene's stable key, so a
 * refresh, another tab or a later session reads exactly what was configured —
 * including a generation that is still running.
 */

const FrameInput = z.object({
  video_project_id: z.string().uuid(),
  scene_key: z.string().min(1).max(600),
  scene_id: z.string().uuid().nullable().optional(),
  start_path: z.string().min(1).max(600),
  end_path: z.string().max(600).nullable().optional(),
  start_asset_id: z.string().uuid().nullable().optional(),
  end_asset_id: z.string().uuid().nullable().optional(),
  start_crop: z.enum(["center", "top", "bottom"]).default("center"),
  end_crop: z.enum(["center", "top", "bottom"]).default("center"),
  motion_preset: z
    .enum(["auto", "walkthrough", "push_in", "pull_out", "pan", "orbit", "reveal", "custom"])
    .default("auto"),
  prompt: z.string().max(400).nullable().optional(),
  seconds: z.number().int().min(4).max(8).default(8),
});

const ProjectScene = z.object({
  video_project_id: z.string().uuid(),
  scene_key: z.string().min(1).max(600),
});

async function assertProject(supabase: any, id: string) {
  const { data } = await supabase.from("video_projects").select("id").eq("id", id).maybeSingle();
  if (!data) throw new Error("That video project is not available on this account.");
}

export const listSceneFrames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ video_project_id: z.string().uuid(), reconcile: z.boolean().default(true) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertProject(context.supabase, data.video_project_id);
    if (data.reconcile) {
      const { reconcileFrames } = await import("@/lib/scene-frames.server");
      return reconcileFrames(context.userId, data.video_project_id);
    }
    const { data: rows, error } = await context.supabase
      .from("scene_start_end")
      .select("*")
      .eq("video_project_id", data.video_project_id);
    if (error) throw new Error(error.message);
    return { frames: rows ?? [], urls: {} as Record<string, string | null> };
  });

export const saveSceneFrames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FrameInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProject(supabase, data.video_project_id);

    const { data: prev } = await supabase
      .from("scene_start_end")
      .select("*")
      .eq("video_project_id", data.video_project_id)
      .eq("scene_key", data.scene_key)
      .maybeSingle();
    const old = prev as any;

    // A finished clip is never thrown away by an edit: it stays until a new
    // generation succeeds, and the row keeps reporting its real state.
    const keepClip = old?.status === "completed" && old?.clip_path;
    const busy = old?.status === "queued" || old?.status === "processing";
    if (busy) throw new Error("This scene is still generating. Wait for it to finish or cancel it first.");

    const row = {
      user_id: userId,
      video_project_id: data.video_project_id,
      scene_key: data.scene_key,
      scene_id: data.scene_id ?? null,
      start_path: data.start_path,
      end_path: data.end_path ?? null,
      start_asset_id: data.start_asset_id ?? null,
      end_asset_id: data.end_asset_id ?? null,
      start_crop: data.start_crop,
      end_crop: data.end_crop,
      motion_preset: data.motion_preset,
      prompt: data.prompt ?? null,
      seconds: data.seconds,
      generation_mode: keepClip ? "ai" : old?.generation_mode || "standard",
      status: keepClip ? "completed" : data.end_path ? "configured" : "incomplete",
      clip_id: keepClip ? old.clip_id : null,
      clip_path: keepClip ? old.clip_path : null,
      progress: keepClip ? 100 : 0,
      error_message: null,
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = await supabase
      .from("scene_start_end")
      .upsert(row, { onConflict: "video_project_id,scene_key" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { frame: saved };
  });

/** Start the real background generation for a saved frame pair. */
export const generateSceneFrames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    ProjectScene.extend({
      orientation: z.enum(["portrait", "landscape"]).default("landscape"),
      room_name: z.string().max(120).nullable().optional(),
      end_room: z.string().max(120).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertProject(context.supabase, data.video_project_id);
    const { data: row } = await context.supabase
      .from("scene_start_end")
      .select("*")
      .eq("video_project_id", data.video_project_id)
      .eq("scene_key", data.scene_key)
      .maybeSingle();
    if (!row) throw new Error("Save the start and end frames first.");
    const { startFrameGeneration } = await import("@/lib/scene-frames.server");
    const out = await startFrameGeneration(context.userId, row as any, {
      orientation: data.orientation,
      room_name: data.room_name ?? null,
      end_room: data.end_room ?? null,
    });
    return { frame: out.frame };
  });

export const cancelSceneFrames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProjectScene.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("scene_start_end")
      .select("*")
      .eq("video_project_id", data.video_project_id)
      .eq("scene_key", data.scene_key)
      .maybeSingle();
    if (!row) return { frame: null };
    const { cancelFrameGeneration } = await import("@/lib/scene-frames.server");
    return { frame: await cancelFrameGeneration(row as any) };
  });

export const clearSceneFrames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProjectScene.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("scene_start_end")
      .delete()
      .eq("video_project_id", data.video_project_id)
      .eq("scene_key", data.scene_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
