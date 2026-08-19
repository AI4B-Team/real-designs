import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sample workspace.
 *
 * Creates one fully worked example property so a brand new account can see
 * what a finished portfolio looks like without spending credits. Everything is
 * written through the caller's own RLS scoped client and is tagged with the
 * SAMPLE_TAG suffix on the address so it can be removed again in one click.
 */

export const SAMPLE_TAG = "(Sample)";

const PhotoInput = z.object({
  photos: z
    .object({
      livingBefore: z.string().min(1).max(500),
      livingAfter: z.string().min(1).max(500),
      kitchenBefore: z.string().min(1).max(500),
      kitchenAfter: z.string().min(1).max(500),
      bathBefore: z.string().min(1).max(500),
    })
    .partial()
    .optional(),
});

type Ctx = { supabase: any };

const ROOMS = [
  {
    key: "living",
    name: "Living Room",
    room_type: "living_room",
    floor_area_sf: 320,
    wall_area_sf: 620,
    perimeter_lf: 72,
    status: "approved",
    items: [
      { label: "flooring", material: "lvp" },
      { label: "wall_paint", material: "paint" },
      { label: "lighting", material: null },
      { label: "trim", material: "mdf" },
    ],
  },
  {
    key: "kitchen",
    name: "Kitchen",
    room_type: "kitchen",
    floor_area_sf: 210,
    wall_area_sf: 420,
    perimeter_lf: 58,
    status: "approved",
    items: [
      { label: "demolition", material: null },
      { label: "cabinets", material: "shaker" },
      { label: "countertop", material: "quartz" },
      { label: "backsplash", material: "tile" },
      { label: "flooring", material: "lvp" },
      { label: "lighting", material: null },
    ],
  },
  {
    key: "bath",
    name: "Primary Bath",
    room_type: "bathroom",
    floor_area_sf: 96,
    wall_area_sf: 280,
    perimeter_lf: 38,
    status: "draft",
    items: [
      { label: "demolition", material: null },
      { label: "tile", material: "porcelain" },
      { label: "vanity", material: "wood" },
      { label: "plumbing_fixtures", material: null },
    ],
  },
] as const;

/** True when the signed-in owner already has the sample property loaded. */
export const hasSampleWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: { context: Ctx }) => {
    const { data, error } = await context.supabase
      .from("properties")
      .select("id, address")
      .ilike("address", `%${SAMPLE_TAG}`)
      .limit(1);
    if (error) throw new Error(error.message);
    return { present: (data ?? []).length > 0 };
  });

/** Create the worked example property, project, rooms, versions and scope items. */
export const loadSampleWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PhotoInput.parse(input ?? {}))
  .handler(async ({ data, context }: { data: z.infer<typeof PhotoInput>; context: Ctx }) => {
    const { supabase } = context;
    const photos = data.photos ?? {};

    const existing = await supabase
      .from("properties")
      .select("id")
      .ilike("address", `%${SAMPLE_TAG}`)
      .limit(1);
    if (existing.error) throw new Error(existing.error.message);
    if ((existing.data ?? []).length) return { created: false, property_id: existing.data[0].id };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const market = await supabaseAdmin.from("markets").select("id").limit(1).single();
    if (market.error) throw new Error(market.error.message);

    const property = await supabase
      .from("properties")
      .insert({
        address: `1420 Bayshore Boulevard, Tampa FL ${SAMPLE_TAG}`,
        market_id: market.data.id,
      })
      .select("id")
      .single();
    if (property.error) throw new Error(property.error.message);

    const project = await supabase
      .from("projects")
      .insert({
        property_id: property.data.id,
        name: "Pre Listing Refresh",
        finish_grade: "retail",
        budget_target: 48000,
      })
      .select("id")
      .single();
    if (project.error) throw new Error(project.error.message);

    for (const room of ROOMS) {
      const r = await supabase
        .from("rooms")
        .insert({
          project_id: project.data.id,
          name: room.name,
          room_type: room.room_type,
          floor_area_sf: room.floor_area_sf,
          wall_area_sf: room.wall_area_sf,
          perimeter_lf: room.perimeter_lf,
          ceiling_ht_in: 96,
          dims_source: "assumed",
          dims_confirmed_at: null,
        })
        .select("id")
        .single();
      if (r.error) throw new Error(r.error.message);

      const before =
        room.key === "kitchen"
          ? photos.kitchenBefore
          : room.key === "bath"
            ? photos.bathBefore
            : photos.livingBefore;
      const after =
        room.key === "kitchen"
          ? photos.kitchenAfter
          : room.key === "bath"
            ? null
            : photos.livingAfter;

      const v = await supabase
        .from("versions")
        .insert({
          room_id: r.data.id,
          version_no: 1,
          status: room.status,
          before_path: before ?? "/placeholder.svg",
          after_path: after ?? null,
        })
        .select("id")
        .single();
      if (v.error) throw new Error(v.error.message);

      const ci = await supabase.from("change_items").insert(
        room.items.map((i) => ({
          version_id: v.data.id,
          action: "replace",
          label: i.label,
          material: i.material,
          grade: "retail",
          qty: null,
          qty_source: "derived",
        })),
      );
      if (ci.error) throw new Error(ci.error.message);
    }

    return { created: true, property_id: property.data.id };
  });

/** Delete every sample property the owner has, cascading to its children. */
export const removeSampleWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: { context: Ctx }) => {
    const { error } = await context.supabase
      .from("properties")
      .delete()
      .ilike("address", `%${SAMPLE_TAG}`);
    if (error) throw new Error(error.message);
    return { removed: true };
  });
