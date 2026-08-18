import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Durable project drafts.
 *
 * A draft is a real database row owned by the signed-in user, not a browser
 * cache. Anything a builder needs to reopen exactly where the user left off
 * lives here: storage paths (never signed URLs), room labels and who assigned
 * them, ordering, and every builder setting. localStorage is only ever a
 * recovery cache for a session that could not reach the server yet.
 */

export const DRAFT_TYPES = ["photo_staging", "photo_redesign", "property_video"] as const;

const DraftAsset = z.object({
  key: z.string().max(80),
  /* Stable private-storage path. Blob/object URLs are refused on purpose. */
  path: z.string().max(600).nullable().optional(),
  name: z.string().max(300).nullable().optional(),
  room: z.string().max(120).nullable().optional(),
  /** Who put the room label there: the classifier, the user, or nobody. */
  room_source: z.enum(["ai", "manual", "none"]).default("none"),
  confidence: z.number().min(0).max(1).default(0),
  selected: z.boolean().default(true),
  done: z.boolean().default(false),
  status: z.string().max(30).default("ready"),
});

export type DraftAssetInput = z.infer<typeof DraftAsset>;

const DraftInput = z.object({
  /* Client-generated so a rerender can never create a second draft. */
  id: z.string().uuid(),
  project_type: z.enum(DRAFT_TYPES),
  property_id: z.string().uuid().nullable().optional(),
  property_address: z.string().max(300).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  status: z.enum(["draft", "active", "complete", "abandoned"]).default("draft"),
  builder_step: z.string().max(40).nullable().optional(),
  video_project_id: z.string().uuid().nullable().optional(),
  assets: z.array(DraftAsset).max(400).optional(),
  selected: z.array(z.string().max(80)).max(400).optional(),
  item_order: z.array(z.string().max(80)).max(400).optional(),
  rooms: z.record(z.string(), z.any()).optional(),
  crop: z.record(z.string(), z.any()).optional(),
  motion: z.record(z.string(), z.any()).optional(),
  effects: z.record(z.string(), z.any()).optional(),
  titles: z.record(z.string(), z.any()).optional(),
  audio: z.record(z.string(), z.any()).optional(),
  branding: z.record(z.string(), z.any()).optional(),
  video_format: z.string().max(20).nullable().optional(),
  quality: z.string().max(20).nullable().optional(),
  settings: z.record(z.string(), z.any()).optional(),
});

export type ProjectDraftInput = z.infer<typeof DraftInput>;

/** Only stable storage paths survive a save; temporary URLs are dropped. */
function cleanAssets(list: DraftAssetInput[] | undefined) {
  if (!list) return undefined;
  return list.map((a) => ({
    ...a,
    path: a.path && !/^(blob:|data:)/i.test(a.path) ? a.path : null,
  }));
}

export const saveProjectDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row: Record<string, unknown> = {
      ...data,
      assets: cleanAssets(data.assets) ?? undefined,
      user_id: userId,
      updated_at: new Date().toISOString(),
      last_opened_at: new Date().toISOString(),
    };
    for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];

    if (data.property_id) {
      const { data: prop } = await supabase
        .from("properties")
        .select("id, address")
        .eq("id", data.property_id)
        .maybeSingle();
      if (!prop) throw new Error("That property is not available on this account.");
    }

    const { data: saved, error } = await (supabase as any)
      .from("project_drafts")
      .upsert(row, { onConflict: "id" })
      .select("id, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { id: saved.id as string, updated_at: saved.updated_at as string };
  });

export const listProjectDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        project_type: z.enum(DRAFT_TYPES).optional(),
        property_id: z.string().uuid().nullable().optional(),
        /** "unassigned" returns drafts that have no property linked yet. */
        scope: z.enum(["all", "unassigned", "drafts"]).default("all"),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any)
      .from("project_drafts")
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (data.project_type) q = q.eq("project_type", data.project_type);
    if (data.property_id) q = q.eq("property_id", data.property_id);
    if (data.scope === "unassigned") q = q.is("property_id", null);
    if (data.scope === "drafts") q = q.eq("status", "draft");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { drafts: rows ?? [] };
  });

export const getProjectDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("project_drafts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row) {
      await (context.supabase as any)
        .from("project_drafts")
        .update({ last_opened_at: new Date().toISOString() })
        .eq("id", data.id);
    }
    return { draft: row ?? null };
  });

export const deleteProjectDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("project_drafts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Attach an unassigned draft to a property, keeping the title untouched. */
export const assignProjectDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        property_id: z.string().uuid().nullable(),
        property_address: z.string().max(300).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { property_id: data.property_id };
    if (data.property_address !== undefined) patch["property_address"] = data.property_address;
    const { error } = await (context.supabase as any)
      .from("project_drafts")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
