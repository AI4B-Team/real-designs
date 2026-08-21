import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Photo Editor persistence.
 *
 * The editor is non-destructive: the original object in storage is never
 * overwritten. Every photo keeps one active edit row (adjustments, crop,
 * rotation, applied AI operations and the rendered result path); "Save As
 * Copy" writes an extra row flagged as a copy so both the original and the
 * copy survive.
 */

const Crop = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0.01).max(1),
    h: z.number().min(0.01).max(1),
    ratio: z.string().max(24).nullable().optional(),
  })
  .nullable()
  .optional();

const Adjustments = z.record(z.string().max(40), z.number()).default({});

const SaveInput = z.object({
  asset_key: z.string().min(1).max(200),
  source_path: z.string().min(1).max(400),
  adjustments: Adjustments,
  crop: Crop,
  rotation: z.number().int().default(0),
  flip_h: z.boolean().default(false),
  ai_ops: z.array(z.string().max(60)).max(30).default([]),
  edited_path: z.string().max(400).nullable().optional(),
  label: z.string().max(200).nullable().optional(),
  as_copy: z.boolean().default(false),
});

export const listPhotoEdits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ keys: z.array(z.string().max(200)).max(300).default([]) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("photo_edits")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(400);
    if (data.keys.length) q = q.in("asset_key", data.keys);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const savePhotoEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const base = {
      user_id: userId,
      asset_key: data.as_copy ? `${data.asset_key}:copy:${crypto.randomUUID()}` : data.asset_key,
      source_path: data.source_path,
      adjustments: data.adjustments,
      crop: data.crop ?? null,
      rotation: data.rotation,
      flip_h: data.flip_h,
      ai_ops: data.ai_ops,
      edited_path: data.edited_path ?? null,
      label: data.label ?? null,
      is_copy: data.as_copy,
      updated_at: new Date().toISOString(),
    };

    if (data.as_copy) {
      const { data: row, error } = await supabase
        .from("photo_edits")
        .insert(base as any)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row;
    }

    const { data: existing } = await supabase
      .from("photo_edits")
      .select("id, revision")
      .eq("asset_key", data.asset_key)
      .eq("is_copy", false)
      .maybeSingle();

    if (existing?.id) {
      const { data: row, error } = await supabase
        .from("photo_edits")
        .update({ ...base, revision: (existing.revision ?? 1) + 1 } as any)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row;
    }

    const { data: row, error } = await supabase
      .from("photo_edits")
      .insert(base as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const resetPhotoEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ asset_key: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("photo_edits")
      .delete()
      .eq("asset_key", data.asset_key)
      .eq("is_copy", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
