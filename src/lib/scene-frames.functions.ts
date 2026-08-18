import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Start / End frame persistence.
 *
 * The frame pair is durable data, not builder state: it lives in
 * `scene_start_end`, keyed by the project plus the scene's stable key, so a
 * refresh, another tab or a later session reads exactly what was configured.
 *
 * Standard Start/End is rendered deterministically in the browser and is
 * therefore free. AI Transition would need a provider that accepts a first AND
 * a last frame; none is connected, so `generation_mode` may only be
 * "standard" here and nothing is ever charged by these functions.
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
  transition_type: z.enum(["blend", "push", "pull", "slide_left", "slide_right", "match"]).default("blend"),
  transition_duration: z.number().min(1).max(12).default(3),
});

async function assertProject(supabase: any, id: string) {
  const { data } = await supabase.from("video_projects").select("id").eq("id", id).maybeSingle();
  if (!data) throw new Error("That video project is not available on this account.");
}

export const listSceneFrames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ video_project_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("scene_start_end")
      .select("*")
      .eq("video_project_id", data.video_project_id);
    if (error) throw new Error(error.message);
    return { frames: rows ?? [] };
  });

export const saveSceneFrames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FrameInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProject(supabase, data.video_project_id);
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
      transition_type: data.transition_type,
      transition_duration: data.transition_duration,
      generation_mode: "standard",
      status: data.end_path ? "configured" : "incomplete",
      credit_cost: 0,
      disclosure: null,
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

export const clearSceneFrames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ video_project_id: z.string().uuid(), scene_key: z.string().min(1).max(600) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("scene_start_end")
      .delete()
      .eq("video_project_id", data.video_project_id)
      .eq("scene_key", data.scene_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
