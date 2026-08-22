import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Property Markup persistence.
 *
 * Markup is stored as structured vectors, never as a flattened picture: the
 * normalized geometry, the type, the style, the labels, the z-order and the
 * visibility all survive, so a document reopens exactly as it was drawn. An
 * export may burn the lines into pixels; this row is what makes that export
 * regenerable without re-drawing anything.
 */

const Point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

const Style = z.object({
  stroke: z.string().max(24),
  strokeWidth: z.number().min(0.5).max(40),
  dash: z.enum(["solid", "dashed", "dotted"]),
  fill: z.string().max(24),
  fillOpacity: z.number().min(0).max(1),
  labelBg: z.string().max(24),
  labelColor: z.string().max(24),
  labelPos: z.enum(["center", "top", "bottom", "start", "end"]),
  labelBackground: z.boolean(),
  arrowHead: z.enum(["none", "end", "both"]),
  fontSize: z.number().min(8).max(80),
});

const Layer = z.object({
  id: z.string().max(80),
  type: z.string().max(24),
  shape: z.enum(["polygon", "line", "arrow", "label", "marker"]),
  name: z.string().max(80),
  points: z.array(Point).min(1).max(400),
  closed: z.boolean(),
  label: z.string().max(120).default(""),
  description: z.string().max(400).optional(),
  number: z.number().int().min(1).max(999).optional(),
  labelOffset: Point.nullable().optional(),
  style: Style,
  visible: z.boolean(),
  locked: z.boolean(),
});

const Doc = z.object({
  version: z.literal(1),
  assetId: z.string().max(200),
  sourceVersionId: z.string().max(200).nullable().optional(),
  visibleDisclosure: z.boolean().default(false),
  layers: z.array(Layer).max(200).default([]),
});

const SaveInput = z.object({
  asset_key: z.string().min(1).max(200),
  source_path: z.string().max(400).nullable().optional(),
  property_id: z.string().uuid().nullable().optional(),
  room_id: z.string().uuid().nullable().optional(),
  version_id: z.string().max(200).nullable().optional(),
  document: Doc,
});

export const listMarkups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ keys: z.array(z.string().max(200)).max(300).default([]) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("photo_markups")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(300);
    if (data.keys.length) q = q.in("asset_key", data.keys);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveMarkup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    /* A manually drawn line is never a verified boundary: the row records the
       warning state so a shared viewer cannot show the lines without it. */
    const needsWarning = data.document.layers.some(
      (l) => l.visible && (l.type === "boundary" || l.type === "access" || l.type === "measurement"),
    );
    const row = {
      user_id: userId,
      asset_key: data.asset_key,
      source_path: data.source_path ?? null,
      property_id: data.property_id ?? null,
      room_id: data.room_id ?? null,
      version_id: data.version_id ?? null,
      document: data.document,
      layer_count: data.document.layers.length,
      requires_warning: needsWarning,
      visible_disclosure: data.document.visibleDisclosure,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("photo_markups")
      .select("id")
      .eq("asset_key", data.asset_key)
      .maybeSingle();

    if (existing?.id) {
      const { data: out, error } = await supabase
        .from("photo_markups")
        .update(row as any)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return out;
    }
    const { data: out, error } = await supabase
      .from("photo_markups")
      .insert(row as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return out;
  });

export const deleteMarkup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ asset_key: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("photo_markups")
      .delete()
      .eq("asset_key", data.asset_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
