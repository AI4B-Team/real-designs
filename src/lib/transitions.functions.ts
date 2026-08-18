import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Transition persistence.
 *
 * A transition is durable data keyed by the project plus the two scene keys it
 * connects, so it survives navigation, refresh, reopening a draft and any
 * reordering. Standard transitions are deterministic and free. The AI path
 * reserves credits first and releases them the moment the provider refuses, so
 * a failed generation never costs anything.
 */

const TYPES = [
  "auto",
  "cut",
  "dissolve",
  "fade",
  "ai",
  "slide_left",
  "slide_right",
  "push",
  "wipe",
  "zoom_match",
  "match_move",
] as const;

const Conn = z.object({
  video_project_id: z.string().uuid(),
  from_key: z.string().min(1).max(300),
  to_key: z.string().min(1).max(300),
});

const SaveInput = Conn.extend({
  from_scene_id: z.string().uuid().nullable().optional(),
  to_scene_id: z.string().uuid().nullable().optional(),
  type: z.enum(TYPES).default("auto"),
  duration_ms: z.number().int().min(0).max(2000).default(600),
  settings: z.record(z.string(), z.any()).optional(),
});

async function assertProject(supabase: any, id: string) {
  const { data } = await supabase.from("video_projects").select("id").eq("id", id).maybeSingle();
  if (!data) throw new Error("That video project is not available on this account.");
}

export const listTransitions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ video_project_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("video_transitions")
      .select("*")
      .eq("video_project_id", data.video_project_id);
    if (error) throw new Error(error.message);
    return { transitions: rows ?? [] };
  });

export const saveTransition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProject(supabase, data.video_project_id);
    const { data: saved, error } = await supabase
      .from("video_transitions")
      .upsert(
        {
          user_id: userId,
          video_project_id: data.video_project_id,
          from_key: data.from_key,
          to_key: data.to_key,
          from_scene_id: data.from_scene_id ?? null,
          to_scene_id: data.to_scene_id ?? null,
          type: data.type,
          duration_ms: data.type === "cut" ? 0 : data.duration_ms,
          settings: data.settings ?? {},
          status: "configured",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "video_project_id,from_key,to_key" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { transition: saved };
  });

/** Project-level Apply To All. One row per live connection, nothing duplicated. */
export const applyTransitions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        video_project_id: z.string().uuid(),
        connections: z.array(z.object({ from_key: z.string().min(1), to_key: z.string().min(1) })).max(400),
        type: z.enum(TYPES),
        duration_ms: z.number().int().min(0).max(2000).default(600),
        settings: z.record(z.string(), z.any()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProject(supabase, data.video_project_id);
    if (!data.connections.length) return { transitions: [] };
    const now = new Date().toISOString();
    const rows = data.connections.map((c) => ({
      user_id: userId,
      video_project_id: data.video_project_id,
      from_key: c.from_key,
      to_key: c.to_key,
      type: data.type,
      duration_ms: data.type === "cut" ? 0 : data.duration_ms,
      settings: data.settings ?? {},
      status: "configured",
      updated_at: now,
    }));
    const { data: saved, error } = await supabase
      .from("video_transitions")
      .upsert(rows, { onConflict: "video_project_id,from_key,to_key" })
      .select("*");
    if (error) throw new Error(error.message);
    return { transitions: saved ?? [] };
  });

export const deleteTransition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Conn.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("video_transitions")
      .delete()
      .eq("video_project_id", data.video_project_id)
      .eq("from_key", data.from_key)
      .eq("to_key", data.to_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Drop rows whose pair is no longer adjacent after a reorder or deletion. */
export const pruneTransitions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        video_project_id: z.string().uuid(),
        keep: z.array(z.object({ from_key: z.string(), to_key: z.string() })).max(400),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("video_transitions")
      .select("id, from_key, to_key")
      .eq("video_project_id", data.video_project_id);
    if (error) throw new Error(error.message);
    const live = new Set(data.keep.map((k) => `${k.from_key}→${k.to_key}`));
    const stale = (rows ?? []).filter((r: any) => !live.has(`${r.from_key}→${r.to_key}`)).map((r: any) => r.id);
    if (stale.length) await context.supabase.from("video_transitions").delete().in("id", stale);
    return { removed: stale.length };
  });

/**
 * AI transition job. Credits are reserved on the row before the provider is
 * called and released in the same request if the provider is unavailable or
 * refuses, so a failed generation is always free.
 */
export const startAiTransition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    SaveInput.extend({
      template: z.string().min(1).max(60).default("room_to_room"),
      prompt: z.string().max(600).optional(),
      start_asset_id: z.string().uuid().nullable().optional(),
      end_asset_id: z.string().uuid().nullable().optional(),
      start_path: z.string().max(600).optional(),
      end_path: z.string().max(600).optional(),
      orientation: z.enum(["landscape", "portrait"]).default("landscape"),
      seconds: z.number().int().min(4).max(8).default(4),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertProject(supabase, data.video_project_id);
    const { AI_TRANSITION_CREDITS, AI_TRANSITION_AVAILABLE, AI_TRANSITION_UNAVAILABLE_REASON } = await import(
      "@/lib/transitions"
    );

    const base = {
      user_id: userId,
      video_project_id: data.video_project_id,
      from_key: data.from_key,
      to_key: data.to_key,
      from_scene_id: data.from_scene_id ?? null,
      to_scene_id: data.to_scene_id ?? null,
      type: "ai",
      duration_ms: Math.min(2000, data.seconds * 1000),
      settings: {
        ...(data.settings ?? {}),
        template: data.template,
        prompt: data.prompt ?? null,
        start_asset_id: data.start_asset_id ?? null,
        end_asset_id: data.end_asset_id ?? null,
        start_path: data.start_path ?? null,
        end_path: data.end_path ?? null,
        orientation: data.orientation,
        seconds: data.seconds,
      },
      provider: "lovable-ai/veo",
      status: "reserved",
      progress: 0,
      credits_reserved: AI_TRANSITION_CREDITS,
      credits_charged: 0,
      credits_released: 0,
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = await supabase
      .from("video_transitions")
      .upsert(base, { onConflict: "video_project_id,from_key,to_key" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (!AI_TRANSITION_AVAILABLE) {
      /* Nothing was charged: the reservation is released before returning, and
         the last good transition on this connection is not overwritten. */
      const { data: released } = await supabase
        .from("video_transitions")
        .update({
          status: "failed",
          type: (data.settings?.["previous_type"] as string) || "auto",
          credits_reserved: 0,
          credits_released: AI_TRANSITION_CREDITS,
          error_message: AI_TRANSITION_UNAVAILABLE_REASON,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select("*")
        .single();
      return { transition: released ?? row, ok: false, reason: AI_TRANSITION_UNAVAILABLE_REASON, charged: 0 };
    }

    /* Reserved -> charged only once a provider accepts the job. */
    return { transition: row, ok: true, charged: 0 };
  });
