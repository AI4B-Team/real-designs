import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Export audit trail: what classification left the building, under which
 * disclosure, when, by whom, for which asset version. Generation prompts are
 * never recorded here.
 */

const AuditRow = z.object({
  classification: z.string().max(48),
  disclosure_id: z.string().max(24),
  disclosure_text: z.string().max(160).nullable().optional(),
  export_preset: z.string().max(40),
  scope: z.string().max(32),
  asset_id: z.string().max(200).nullable().optional(),
  version_id: z.string().max(200).nullable().optional(),
  file_name: z.string().max(200).nullable().optional(),
});

export const recordExportAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(AuditRow).min(1).max(200) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("export_audits").insert(
      data.rows.map((r) => ({
        user_id: userId,
        classification: r.classification,
        disclosure_id: r.disclosure_id,
        disclosure_text: r.disclosure_text ?? null,
        export_preset: r.export_preset,
        scope: r.scope,
        asset_id: r.asset_id ?? null,
        version_id: r.version_id ?? null,
        file_name: r.file_name ?? null,
      })),
    );
    if (error) throw new Error(error.message);
    return { saved: data.rows.length };
  });

export const listExportAudits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("export_audits")
      .select("*")
      .order("exported_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
