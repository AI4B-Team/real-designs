import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchParcel, providerConfigured, providerName } from "@/lib/parcel.server";

/**
 * Parcel import.
 *
 * Geometry is only ever relayed from a configured parcel/GIS provider. When no
 * provider is configured, or the provider has nothing for the address, this
 * returns a plain failure — it never draws a plausible rectangle around the
 * house, and no shape reaches the client without a parcel id, a provider name
 * and a retrieval timestamp attached.
 */

const LookupInput = z.object({
  address: z.string().min(4).max(300),
  parcel_id: z.string().max(120).nullable().optional(),
  asset_key: z.string().max(200).nullable().optional(),
  property_id: z.string().uuid().nullable().optional(),
});

export const parcelProviderStatus = createServerFn({ method: "GET" }).handler(async () => ({
  configured: providerConfigured(),
  provider: providerName(),
}));

export const lookupParcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LookupInput.parse(input))
  .handler(async ({ data, context }) => {
    const result = await fetchParcel({ address: data.address, parcelId: data.parcel_id ?? null });
    if (!result.ok) {
      /* A failed retrieval is recorded as a failure, with no geometry. */
      await context.supabase.from("parcel_imports").insert({
        user_id: context.userId,
        asset_key: data.asset_key ?? null,
        property_id: data.property_id ?? null,
        address: data.address,
        parcel_id: data.parcel_id ?? null,
        provider: providerName(),
        status: "failed",
        error: result.error,
        geometry: null,
        audit: [{ at: new Date().toISOString(), action: "import", detail: { ok: false, error: result.error } }],
      } as any);
      return { ok: false as const, error: result.error };
    }
    const { data: row, error } = await context.supabase
      .from("parcel_imports")
      .insert({
        user_id: context.userId,
        asset_key: data.asset_key ?? null,
        property_id: data.property_id ?? null,
        address: result.record.address,
        parcel_id: result.record.parcelId,
        provider: result.record.provider,
        jurisdiction: result.record.jurisdiction,
        license: result.record.license,
        retrieved_at: result.record.retrievedAt,
        status: "retrieved",
        geometry: result.record.geometry as any,
        georeference: result.georeference as any,
        audit: [{ at: new Date().toISOString(), action: "import", detail: { ok: true } }],
      } as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      ok: true as const,
      import_id: row?.id ?? null,
      record: result.record,
      georeference: result.georeference,
    };
  });

const AlignmentInput = z.object({
  import_id: z.string().uuid(),
  alignment: z.record(z.string(), z.any()),
  confidence: z.enum(["georeferenced", "manual", "unaligned"]),
  warning_accepted: z.boolean().default(false),
  confirmed: z.boolean().default(false),
  audit: z.array(z.object({ at: z.string(), action: z.string(), detail: z.any().optional() })).max(200).default([]),
});

export const saveParcelAlignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AlignmentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("parcel_imports")
      .update({
        alignment: data.alignment as any,
        confidence: data.confidence,
        warning_accepted: data.warning_accepted,
        aligned_at: data.confirmed ? new Date().toISOString() : null,
        status: data.confirmed ? "aligned" : "retrieved",
        audit: data.audit as any,
      } as any)
      .eq("id", data.import_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const logParcelExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        import_id: z.string().uuid(),
        export_kind: z.string().max(40),
        layer_ids: z.array(z.string().max(80)).max(200).default([]),
        warning_shown: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("parcel_imports")
      .select("export_history")
      .eq("id", data.import_id)
      .maybeSingle();
    const history = Array.isArray((existing as any)?.export_history)
      ? (existing as any).export_history
      : [];
    history.push({
      at: new Date().toISOString(),
      kind: data.export_kind,
      layers: data.layer_ids.length,
      warning_shown: data.warning_shown,
    });
    const { error } = await context.supabase
      .from("parcel_imports")
      .update({ export_history: history as any } as any)
      .eq("id", data.import_id);
    if (error) throw new Error(error.message);
    return { ok: true, exports: history.length };
  });
