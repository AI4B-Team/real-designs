import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Saved projects.
 *
 * Persists the estimator's working state into the owned hierarchy
 * (property -> project -> room -> version -> change_items) so the priced
 * scope can be rebuilt later by buildScope. RLS scopes everything to the
 * signed-in owner; no ownership value is ever accepted from the client.
 */

const SaveInput = z.object({
  address: z.string().min(3).max(200),
  project_name: z.string().min(1).max(120),
  room_name: z.string().min(1).max(120),
  room_type: z.string().min(1).max(60),
  grade: z.enum(["rental", "retail", "premium"]),
  market_id: z.string().uuid(),
  budget_target: z.number().positive().nullable().optional(),
  floor_area_sf: z.number().positive(),
  wall_area_sf: z.number().positive(),
  perimeter_lf: z.number().positive(),
  ceiling_ht_in: z.number().positive().default(96),
  dims_source: z.enum(["user", "floor_plan", "depth_estimate", "assumed"]).default("user"),
  dims_confirmed: z.boolean().default(false),
  before_path: z.string().min(1),
  after_path: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        label: z.string().min(1),
        material: z.string().nullable().optional(),
        qty: z.number().positive().nullable().optional(),
      }),
    )
    .min(1),
});

export const saveEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: property, error: pErr } = await supabase
      .from("properties")
      .insert({ address: data.address, market_id: data.market_id })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);

    const { data: project, error: prErr } = await supabase
      .from("projects")
      .insert({
        property_id: property.id,
        name: data.project_name,
        finish_grade: data.grade,
        budget_target: data.budget_target ?? null,
      })
      .select("id")
      .single();
    if (prErr) throw new Error(prErr.message);

    const { data: room, error: rErr } = await supabase
      .from("rooms")
      .insert({
        project_id: project.id,
        name: data.room_name,
        room_type: data.room_type,
        floor_area_sf: data.floor_area_sf,
        wall_area_sf: data.wall_area_sf,
        perimeter_lf: data.perimeter_lf,
        ceiling_ht_in: data.ceiling_ht_in,
        dims_source: data.dims_source,
        dims_confirmed_at: data.dims_confirmed ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (rErr) throw new Error(rErr.message);

    const { data: version, error: vErr } = await supabase
      .from("versions")
      .insert({
        room_id: room.id,
        version_no: 1,
        status: "draft",
        before_path: data.before_path,
        after_path: data.after_path ?? null,
      })
      .select("id")
      .single();
    if (vErr) throw new Error(vErr.message);

    const { error: ciErr } = await supabase.from("change_items").insert(
      data.items.map((i) => ({
        version_id: version.id,
        action: "replace",
        label: i.label,
        material: i.material ?? null,
        grade: data.grade,
        qty: i.qty ?? null,
        qty_source: i.qty == null ? "derived" : "detected",
      })),
    );
    if (ciErr) throw new Error(ciErr.message);

    return { version_id: version.id, room_id: room.id, property_id: property.id };
  });

/** Everything the signed-in owner has saved, newest first. */
export const listSavedEstimates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("versions")
      .select(
        `id, created_at, before_path,
         rooms!inner ( id, name, room_type,
           projects!inner ( id, name, finish_grade,
             properties!inner ( id, address ) ) ),
         scopes ( total_low, total_high, budget_fit, pricing_conf, computed_at )`,
      )
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);

    return (data ?? []).map((v: any) => {
      const scope = (v.scopes ?? [])[0] ?? null;
      return {
        version_id: v.id as string,
        created_at: v.created_at as string,
        address: v.rooms.projects.properties.address as string,
        project_name: v.rooms.projects.name as string,
        room_name: v.rooms.name as string,
        grade: v.rooms.projects.finish_grade as string,
        total_low: scope ? Number(scope.total_low) : null,
        total_high: scope ? Number(scope.total_high) : null,
        budget_fit: scope?.budget_fit ?? null,
      };
    });
  });

export const deleteSavedEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ version_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("versions").delete().eq("id", data.version_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
