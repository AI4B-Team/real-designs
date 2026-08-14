import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Property media: the property-centred store behind Complete Property Upload.
 *
 * It extends the existing owned hierarchy — assets point at the same
 * `properties` rows the Property Tree, Listing Batch and Scope & Budget already
 * use. Originals are never overwritten: every edit lands in
 * `property_media_versions`, and the asset only tracks which version is
 * approved. RLS scopes everything to the signed-in owner.
 */

const QUALITY = z
  .object({
    blur: z.number().nullable().optional(),
    exposure: z.number().nullable().optional(),
    brightness: z.number().nullable().optional(),
    warmth: z.number().nullable().optional(),
    vertical: z.number().nullable().optional(),
    hash: z.string().max(80).nullable().optional(),
    lowRes: z.boolean().optional(),
  })
  .passthrough();

const AssetInput = z.object({
  property_id: z.string().uuid().nullable().optional(),
  property_label: z.string().max(200).nullable().optional(),
  batch_id: z.string().uuid().nullable().optional(),
  storage_path: z.string().min(1).max(400),
  original_filename: z.string().max(240).nullable().optional(),
  file_type: z.string().max(60).nullable().optional(),
  file_size: z.number().int().nonnegative().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  source_type: z.string().max(40).default("computer"),
  room_group: z.string().max(60).default("Needs Review"),
  room_confidence: z.number().min(0).max(1).default(0),
  angle_group: z.string().max(80).nullable().optional(),
  hdr_group: z.string().max(80).nullable().optional(),
  dup_group: z.string().max(80).nullable().optional(),
  flags: z.array(z.string().max(40)).max(20).default([]),
  quality: QUALITY.default({}),
  recommended: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

export const createMediaAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ assets: z.array(AssetInput).min(1).max(50) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.assets.map((a) => ({ ...a, user_id: userId }));
    const { data: out, error } = await supabase.from("property_media_assets").insert(rows as any).select("id, storage_path");
    if (error) throw new Error(error.message);
    return out ?? [];
  });

export const listMediaAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ property_id: z.string().uuid().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("property_media_assets")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(600);
    if (data.property_id) q = q.eq("property_id", data.property_id);
    const { data: assets, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (assets ?? []).map((a: any) => a.id);
    let versions: any[] = [];
    if (ids.length) {
      const { data: v, error: ve } = await supabase
        .from("property_media_versions")
        .select("*")
        .in("asset_id", ids)
        .order("created_at", { ascending: true });
      if (ve) throw new Error(ve.message);
      versions = v ?? [];
    }
    return { assets: assets ?? [], versions };
  });

export const updateMediaAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(400),
        patch: z.object({
          file_name: z.string().max(200).optional(),
          room_group: z.string().max(60).optional(),
          room_confidence: z.number().min(0).max(1).optional(),
          hidden: z.boolean().optional(),
          recommended: z.boolean().optional(),
          modification_class: z.string().max(40).optional(),
          property_id: z.string().uuid().nullable().optional(),
          property_label: z.string().max(200).nullable().optional(),
          sort_order: z.number().int().optional(),
          approved_version_id: z.string().uuid().nullable().optional(),
          flags: z.array(z.string().max(40)).max(20).optional(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("property_media_assets").update(data.patch as any).in("id", data.ids);
    if (error) throw new Error(error.message);
    return { updated: data.ids.length };
  });

export const deleteMediaAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(400) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("property_media_assets").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { deleted: data.ids.length };
  });

export const addMediaVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        asset_id: z.string().uuid(),
        label: z.string().min(1).max(80),
        kind: z.enum(["enhanced", "ai_edit", "design"]).default("enhanced"),
        modification_class: z
          .enum(["Unmodified Original", "Enhanced", "Digitally Altered", "Virtually Staged", "AI-Generated Concept", "Proposed Design"])
          .default("Enhanced"),
        storage_path: z.string().min(1).max(400),
        ops: z.record(z.string(), z.unknown()).default({}),
        approve: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("property_media_versions")
      .insert({
        user_id: userId,
        asset_id: data.asset_id,
        label: data.label,
        kind: data.kind,
        modification_class: data.modification_class,
        storage_path: data.storage_path,
        ops: data.ops,
        approved: data.approve,
      } as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const patch: Record<string, unknown> = { modification_class: data.modification_class };
    if (data.approve) patch["approved_version_id"] = row.id;
    await supabase.from("property_media_assets").update(patch as any).eq("id", data.asset_id);
    return row;
  });

export const approveMediaVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ asset_id: z.string().uuid(), version_id: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("property_media_versions").update({ approved: false }).eq("asset_id", data.asset_id);
    if (data.version_id) {
      const { error } = await supabase
        .from("property_media_versions")
        .update({ approved: true })
        .eq("id", data.version_id);
      if (error) throw new Error(error.message);
    }
    const { error: ae } = await supabase
      .from("property_media_assets")
      .update({ approved_version_id: data.version_id })
      .eq("id", data.asset_id);
    if (ae) throw new Error(ae.message);
    return { ok: true };
  });

export const updateMediaVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().min(1).max(80).optional(),
        archived: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("property_media_versions").update(patch as any).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMediaVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("property_media_versions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMediaProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("properties")
      .select("id, address, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createMediaProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ address: z.string().min(2).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("properties")
      .insert({ owner_id: userId, address: data.address } as any)
      .select("id, address")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveExportPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        property_id: z.string().uuid().nullable().optional(),
        property_label: z.string().max(200).nullable().optional(),
        preset: z.string().max(60),
        label: z.string().max(160),
        file_count: z.number().int().nonnegative(),
        options: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("property_media_exports")
      .insert({ ...data, user_id: context.userId } as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listExportPackages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ property_id: z.string().uuid().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("property_media_exports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.property_id) q = q.eq("property_id", data.property_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
