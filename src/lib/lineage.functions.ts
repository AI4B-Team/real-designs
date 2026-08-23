import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The canonical lineage endpoints. Every workflow that saves, branches,
 * inspects or deletes a durable image goes through here, so lineage can never
 * be half-written by one screen and ignored by another.
 */

const Ref = z.object({
  kind: z.enum(["asset", "version"]),
  id: z.string().uuid(),
  path: z.string().min(1).max(400),
});

const OPERATIONS = [
  "upload",
  "import",
  "edit",
  "crop",
  "rotate",
  "enhance",
  "privacy_blur",
  "generate",
  "restyle",
  "upscale",
  "convert",
  "copy",
] as const;

/** Version History: durable rows plus the exact active selection. */
export const getAssetLineage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        asset_id: z.string().uuid(),
        active_version_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { readLineage } = await import("@/lib/lineage.server");
    const view = await readLineage(
      context.supabase,
      data.asset_id,
      data.active_version_id ?? null,
    );
    return {
      asset: view.asset,
      versions: view.versions,
      active: view.active,
      adapted: view.adaptedCount,
    };
  });

/** Save as New Version — the only way an edit becomes durable. */
export const saveDerivedVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        asset_id: z.string().uuid(),
        parent: Ref,
        operation: z.enum(OPERATIONS),
        output_path: z.string().min(1).max(400),
        label: z.string().min(1).max(80),
        kind: z.enum(["enhanced", "ai_edit", "design"]).default("enhanced"),
        modification_class: z.string().max(40).default("Enhanced"),
        job_id: z.string().max(120).nullable().optional(),
        settings: z.record(z.string(), z.unknown()).default({}),
        approve: z.boolean().default(false),
        project_id: z.string().uuid().nullable().optional(),
        room_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { recordDerivedVersion } = await import("@/lib/lineage.server");
    return await recordDerivedVersion(context.supabase, {
      userId: context.userId,
      assetId: data.asset_id,
      parent: data.parent,
      operation: data.operation,
      outputPath: data.output_path,
      label: data.label,
      kind: data.kind,
      modificationClass: data.modification_class,
      jobId: data.job_id ?? null,
      settings: data.settings,
      approve: data.approve,
      projectId: data.project_id ?? null,
      roomId: data.room_id ?? null,
    });
  });

/** Save as Copy — a separate durable asset with its own lineage branch. */
export const saveVersionAsCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        asset_id: z.string().uuid(),
        parent: Ref,
        output_path: z.string().min(1).max(400),
        label: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { saveAsCopy } = await import("@/lib/lineage.server");
    return await saveAsCopy(context.supabase, {
      userId: context.userId,
      assetId: data.asset_id,
      parent: data.parent,
      outputPath: data.output_path,
      ...(data.label ? { label: data.label } : {}),
    });
  });

/** Deletion that refuses while anything still references the bytes. */
export const deleteVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ version_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { deleteVersionSafely } = await import("@/lib/lineage.server");
    return await deleteVersionSafely(context.supabase, context.userId, data.version_id);
  });

/** Read-only orphan report. It never deletes a single object. */
export const getOrphanReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orphanDiagnostic } = await import("@/lib/lineage.server");
    const { supabase } = context;
    const report = await orphanDiagnostic(
      supabase,
      {
        list: async (bucket, prefix) => {
          const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
          if (error) throw new Error(error.message);
          return (data ?? [])
            .filter((o) => o.name && o.id !== null)
            .map((o) => ({
              path: `${prefix}/${o.name}`,
              createdAt: o.created_at ?? "",
              size: (o.metadata as { size?: number } | null)?.size ?? null,
            }));
        },
      },
      context.userId,
    );
    return report;
  });
