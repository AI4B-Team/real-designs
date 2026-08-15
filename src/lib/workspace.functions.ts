import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { propLabel } from "@/lib/property-label";

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

    /* Reuse an existing property with the same address instead of creating a
       duplicate row. Without this, every save spawned another property, so
       pickers filled up with repeated "Unsorted Uploads" / same-address rows. */
    const wanted = data.address.trim();
    const { data: existing } = await supabase
      .from("properties")
      .select("id")
      .ilike("address", wanted)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let property = existing as { id: string } | null;
    if (!property) {
      const { data: created, error: pErr } = await supabase
        .from("properties")
        .insert({ address: wanted, market_id: data.market_id })
        .select("id")
        .single();
      if (pErr) throw new Error(pErr.message);
      property = created;
    }


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
        `id, created_at, before_path, version_no, status,
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
        before_path: (v.before_path ?? null) as string | null,
        version_no: (v.version_no ?? 1) as number,
        status: (v.status ?? "draft") as string,
        address: propLabel(v.rooms.projects.properties.address),
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


/** Dashboard rollup for the signed-in owner: counts, recent rooms, budget by property. */
export const getWorkspaceSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const [{ data: props, error: pErr }, { data: versions, error: vErr }] = await Promise.all([
      supabase.from("properties").select("id, address, created_at").order("created_at", { ascending: false }),
      supabase
        .from("versions")
        .select(
          `id, created_at, status, before_path,
           rooms!inner ( id, name, room_type,
             projects!inner ( id, name, finish_grade, budget_target,
               properties!inner ( id, address ) ) ),
           scopes ( total_low, total_high, budget_fit )`,
        )
        .order("created_at", { ascending: false }),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (vErr) throw new Error(vErr.message);

    const rows = (versions ?? []) as any[];
    const flat = rows.map((v) => {
      const scope = (v.scopes ?? [])[0] ?? null;
      return {
        version_id: v.id as string,
        created_at: v.created_at as string,
        status: (v.status ?? "draft") as string,
        before_path: (v.before_path ?? null) as string | null,
        room_name: v.rooms.name as string,
        room_type: v.rooms.room_type as string,
        project_id: v.rooms.projects.id as string,
        project_name: v.rooms.projects.name as string,
        grade: v.rooms.projects.finish_grade as string,
        budget_target: v.rooms.projects.budget_target == null ? null : Number(v.rooms.projects.budget_target),
        property_id: v.rooms.projects.properties.id as string,
        address: propLabel(v.rooms.projects.properties.address),
        total_low: scope ? Number(scope.total_low) : null,
        total_high: scope ? Number(scope.total_high) : null,
      };
    });

    const byProject = new Map<string, any>();
    for (const r of flat) {
      const k = r.project_id;
      const cur = byProject.get(k) ?? {
        project_id: k,
        project_name: r.project_name,
        address: r.address,
        grade: r.grade,
        budget_target: r.budget_target,
        rooms: 0,
        low: 0,
        high: 0,
        priced: 0,
      };
      cur.rooms += 1;
      if (r.total_low != null) {
        cur.low += r.total_low;
        cur.high += r.total_high ?? r.total_low;
        cur.priced += 1;
      }
      byProject.set(k, cur);
    }

    const scopedTotal = flat.reduce((s, r) => s + (r.total_high ?? 0), 0);

    return {
      counts: {
        properties: (props ?? []).length,
        designs: flat.length,
        priced: flat.filter((r) => r.total_low != null).length,
        drafts: flat.filter((r) => r.status !== "approved").length,
        scopedTotal,
      },
      recent: flat.slice(0, 5),
      projects: Array.from(byProject.values()),
      properties: (props ?? []).map((p: any) => ({ id: p.id, address: propLabel(p.address) })),
    };
  });

/** Full owned hierarchy for the Properties view: property -> project -> room -> latest version. */
export const getPropertyTree = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { withRetry } = await import("./db-retry.server");

    const { data, error } = await withRetry(async () =>
      supabase
        .from("properties")
        .select(
          `id, address, design_dna, created_at,
         property_media_assets ( count ),
         projects ( id, name, finish_grade, budget_target, created_at,
           rooms ( id, name, room_type, created_at,
             versions ( id, version_no, status, before_path, after_path, created_at,
               scopes ( total_low, total_high, budget_fit ) ) ) )`,
        )
        .order("created_at", { ascending: false }),
    );
    if (error) throw new Error(error.message);


    return (data ?? []).map((p: any) => ({
      id: p.id as string,
      address: propLabel(p.address),
      created_at: p.created_at as string,
      /* Upload-only properties have assets and no rooms, so the card needs
         this count to avoid reading "0 Rooms". */
      asset_count: Number(
        Array.isArray(p.property_media_assets) ? (p.property_media_assets[0]?.count ?? 0) : 0,
      ),

      has_dna: Array.isArray(p.design_dna?.items) && p.design_dna.items.length > 0,
      dna: (Array.isArray(p.design_dna?.items) ? p.design_dna.items : []) as {
        label: string;
        color: string;
      }[],
      projects: (p.projects ?? [])
        .slice()
        .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)))
        .map((pr: any) => ({
          id: pr.id as string,
          name: pr.name as string,
          grade: pr.finish_grade as string,
          budget_target: pr.budget_target == null ? null : Number(pr.budget_target),
          rooms: (pr.rooms ?? [])
            .slice()
            .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)))
            .map((r: any) => {
              const versions = (r.versions ?? [])
                .slice()
                .sort((a: any, b: any) => (b.version_no ?? 0) - (a.version_no ?? 0));
              const latest = versions[0] ?? null;
              const scope = latest ? ((latest.scopes ?? [])[0] ?? null) : null;
              return {
                id: r.id as string,
                name: r.name as string,
                version_id: (latest?.id ?? null) as string | null,
                room_type: r.room_type as string,
                versions: versions.length,
                version_no: latest?.version_no ?? null,
                status: latest?.status ?? null,
                before_path: latest?.before_path ?? null,
                after_path: latest?.after_path ?? null,
                total_low: scope ? Number(scope.total_low) : null,
                total_high: scope ? Number(scope.total_high) : null,
              };
            }),
        })),
    }));
  });

/**
 * Store a batch-generated render as a new version of an existing owned room.
 * RLS on `versions` proves ownership through room -> project -> property.
 */
export const saveRoomVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        room_id: z.string().uuid(),
        before_path: z.string().min(1),
        after_path: z.string().min(1),
        style: z.string().max(80).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: prev, error: prevErr } = await supabase
      .from("versions")
      .select("version_no")
      .eq("room_id", data.room_id)
      .order("version_no", { ascending: false })
      .limit(1);
    if (prevErr) throw new Error(prevErr.message);

    const next = ((prev ?? [])[0]?.version_no ?? 0) + 1;

    const { data: row, error } = await supabase
      .from("versions")
      .insert({
        room_id: data.room_id,
        version_no: next,
        status: "draft",
        style: data.style ?? null,
        before_path: data.before_path,
        after_path: data.after_path,
        gen_model: "google/gemini-2.5-flash-image",
      })
      .select("id, version_no")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id as string, version_no: row.version_no as number };
  });

/** Design DNA is a small ordered list of finish decisions locked to a property. */
const dnaSchema = z.object({
  property_id: z.string().uuid(),
  items: z
    .array(z.object({ label: z.string().min(1).max(60), color: z.string().max(24) }))
    .max(12),
});

export const setPropertyDna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => dnaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("properties")
      .update({ design_dna: { items: data.items } })
      .eq("id", data.property_id);
    if (error) throw new Error(error.message);
    return { ok: true, items: data.items };
  });

/** Copy one property's locked DNA onto another owned property. */
export const copyPropertyDna = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ from_id: z.string().uuid(), to_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: src, error: srcErr } = await supabase
      .from("properties")
      .select("design_dna")
      .eq("id", data.from_id)
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!src?.design_dna) throw new Error("That property has no locked Design DNA yet.");
    const { error } = await supabase
      .from("properties")
      .update({ design_dna: src.design_dna })
      .eq("id", data.to_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** A scenario is a second project under the same property (for example a rental grade pass). */
export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        property_id: z.string().uuid(),
        name: z.string().min(1).max(80),
        finish_grade: z.string().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("projects")
      .insert({
        property_id: data.property_id,
        name: data.name,
        finish_grade: data.finish_grade ?? "retail",
      })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, name: row.name as string };
  });

/** Approve or reset a saved version. Approval is what client packages are built from. */
export const setVersionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ version_id: z.string().uuid(), status: z.enum(["draft", "approved"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("versions")
      .update({ status: data.status })
      .eq("id", data.version_id);
    if (error) throw new Error(error.message);
    return { ok: true, status: data.status };
  });

/** Every saved version of one room, newest first, with its priced range. */
export const listRoomVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ room_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("versions")
      .select("id, version_no, status, style, before_path, after_path, created_at, scopes ( total_low, total_high )")
      .eq("room_id", data.room_id)
      .order("version_no", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((v: any) => {
      const s = (v.scopes ?? [])[0] ?? null;
      return {
        id: v.id as string,
        version_no: (v.version_no ?? 1) as number,
        status: (v.status ?? "draft") as string,
        style: (v.style ?? null) as string | null,
        before_path: (v.before_path ?? null) as string | null,
        after_path: (v.after_path ?? null) as string | null,
        created_at: v.created_at as string,
        total_low: s ? Number(s.total_low) : null,
        total_high: s ? Number(s.total_high) : null,
      };
    });
  });

/** Bulk status change across saved versions (approve, review, archive, reset). */
export const setVersionStatusBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        version_ids: z.array(z.string().uuid()).min(1).max(200),
        status: z.enum(["draft", "review", "approved", "archived"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("versions")
      .update({ status: data.status })
      .in("id", data.version_ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.version_ids.length, status: data.status };
  });

/** Permanently delete saved versions the caller owns. RLS scopes the delete. */
export const deleteVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ version_ids: z.array(z.string().uuid()).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("versions").delete().in("id", data.version_ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.version_ids.length };
  });
