import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { propLabel } from "@/lib/property-label";

/**
 * Saved rooms.
 *
 * A room is the durable record of one real space: its property, its project,
 * its name, its type and the storage path of its source photo. A room can be
 * saved long before any AI design exists; generated designs are stored
 * separately as versions belonging to that room.
 *
 * Everything here is idempotent. Repeated saves update the same room instead
 * of spawning duplicate properties, projects, rooms or versions. RLS scopes
 * every read and write to the signed-in owner; ownership is never accepted
 * from the client.
 */

/** Only durable storage paths may reach the database. */
const durablePath = z
  .string()
  .min(1)
  .max(400)
  .refine((v) => !/^(blob:|data:|https?:)/i.test(v.trim()), {
    message: "Only stored photo paths can be saved, not temporary browser URLs.",
  });

const SaveRoomInput = z.object({
  /** Present when the caller already knows the room; makes the save an update. */
  room_id: z.string().uuid().nullable().optional(),
  property_id: z.string().uuid().nullable().optional(),
  address: z.string().trim().min(3).max(200).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  project_name: z.string().trim().min(1).max(160).nullable().optional(),
  room_name: z.string().trim().min(1).max(120),
  room_type: z.string().trim().min(1).max(60),
  source_path: durablePath,
});

export type SavedRoom = {
  property_id: string;
  project_id: string;
  room_id: string;
  room_name: string;
  room_type: string;
  address: string;
  source_path: string;
  created: boolean;
};

export const saveStudioRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveRoomInput.parse(input))
  .handler(async ({ data, context }): Promise<SavedRoom> => {
    const { supabase } = context;
    const roomName = data.room_name.trim();
    const roomType = data.room_type.trim();
    const sourcePath = data.source_path.trim();

    /* ---- existing room: a plain update, never a second row ---- */
    if (data.room_id) {
      const { data: row, error } = await supabase
        .from("rooms")
        .update({ name: roomName, room_type: roomType, source_path: sourcePath })
        .eq("id", data.room_id)
        .select("id, project_id, projects!inner ( id, property_id, properties!inner ( id, address ) )")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (row) {
        const project = (row as any).projects;
        return {
          property_id: project.property_id as string,
          project_id: row.project_id as string,
          room_id: row.id as string,
          room_name: roomName,
          room_type: roomType,
          address: propLabel(project.properties.address),
          source_path: sourcePath,
          created: false,
        };
      }
      /* The room is gone (deleted elsewhere): fall through and create a fresh one. */
    }

    /* ---- property ---- */
    let propertyId = data.property_id ?? null;
    let address = (data.address ?? "").trim();

    if (propertyId) {
      const { data: p, error } = await supabase
        .from("properties")
        .select("id, address")
        .eq("id", propertyId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!p) throw new Error("That property is no longer available.");
      address = p.address as string;
    } else {
      if (address.length < 3) throw new Error("Choose a property or add its address.");
      const { data: found, error: fErr } = await supabase
        .from("properties")
        .select("id, address")
        .ilike("address", address)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (fErr) throw new Error(fErr.message);
      if (found) {
        propertyId = found.id as string;
        address = found.address as string;
      } else {
        const { data: created, error: cErr } = await supabase
          .from("properties")
          .insert({ address })
          .select("id, address")
          .single();
        if (cErr) throw new Error(cErr.message);
        propertyId = created.id as string;
        address = created.address as string;
      }
    }

    /* ---- project: reuse the property's first project unless one was named ---- */
    let projectId = data.project_id ?? null;
    if (projectId) {
      const { data: pr, error } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("property_id", propertyId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!pr) projectId = null;
    }
    if (!projectId) {
      const { data: pr, error } = await supabase
        .from("projects")
        .select("id")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      projectId = (pr?.id as string) ?? null;
    }
    if (!projectId) {
      const { data: pr, error } = await supabase
        .from("projects")
        .insert({
          property_id: propertyId,
          name: (data.project_name ?? "").trim() || propLabel(address) || "Saved Rooms",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      projectId = pr.id as string;
    }

    /* ---- room: the same photo (or the same room name) is always one room ---- */
    const { data: siblings, error: sErr } = await supabase
      .from("rooms")
      .select("id, name, room_type, source_path")
      .eq("project_id", projectId);
    if (sErr) throw new Error(sErr.message);

    const match =
      (siblings ?? []).find((r: any) => r.source_path && r.source_path === sourcePath) ??
      (siblings ?? []).find(
        (r: any) => !r.source_path && String(r.name).toLowerCase() === roomName.toLowerCase(),
      ) ??
      null;

    if (match) {
      const { error } = await supabase
        .from("rooms")
        .update({ name: roomName, room_type: roomType, source_path: sourcePath })
        .eq("id", (match as any).id);
      if (error) throw new Error(error.message);
      return {
        property_id: propertyId!,
        project_id: projectId,
        room_id: (match as any).id as string,
        room_name: roomName,
        room_type: roomType,
        address: propLabel(address),
        source_path: sourcePath,
        created: false,
      };
    }

    const { data: room, error: rErr } = await supabase
      .from("rooms")
      .insert({
        project_id: projectId,
        name: roomName,
        room_type: roomType,
        source_path: sourcePath,
      })
      .select("id")
      .single();
    if (rErr) throw new Error(rErr.message);

    return {
      property_id: propertyId!,
      project_id: projectId,
      room_id: room.id as string,
      room_name: roomName,
      room_type: roomType,
      address: propLabel(address),
      source_path: sourcePath,
      created: true,
    };
  });

const SaveVersionInput = z.object({
  room_id: z.string().uuid(),
  before_path: durablePath,
  after_path: durablePath,
  style: z.string().trim().max(120).nullable().optional(),
  intensity: z.string().trim().max(60).nullable().optional(),
  grade: z.string().trim().max(60).nullable().optional(),
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
});

/** Stores one generated design as the next draft version of a saved room. */
export const saveStudioVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveVersionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    /* The same generated image is one version, however many times it is saved. */
    const { data: dupe, error: dErr } = await supabase
      .from("versions")
      .select("id, version_no")
      .eq("room_id", data.room_id)
      .eq("after_path", data.after_path)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (dupe)
      return { id: dupe.id as string, version_no: dupe.version_no as number, created: false };

    const { data: prev, error: pErr } = await supabase
      .from("versions")
      .select("version_no")
      .eq("room_id", data.room_id)
      .order("version_no", { ascending: false })
      .limit(1);
    if (pErr) throw new Error(pErr.message);

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
        gen_params: {
          intensity: data.intensity ?? null,
          grade: data.grade ?? null,
          ...(data.settings ?? {}),
        },
      })
      .select("id, version_no")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id as string, version_no: row.version_no as number, created: true };
  });

/**
 * Truth for onboarding and the Saved Designs count.
 *
 * `rooms` counts persistent saved rooms; `designs` counts only versions that
 * actually carry a generated image, so a source-only room never inflates it.
 */
export const getRoomStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [rooms, designs, properties] = await Promise.all([
      supabase.from("rooms").select("id", { count: "exact", head: true }),
      supabase
        .from("versions")
        .select("id", { count: "exact", head: true })
        .not("after_path", "is", null),
      supabase.from("properties").select("id", { count: "exact", head: true }),
    ]);
    if (rooms.error) throw new Error(rooms.error.message);
    if (designs.error) throw new Error(designs.error.message);
    if (properties.error) throw new Error(properties.error.message);
    return {
      rooms: rooms.count ?? 0,
      designs: designs.count ?? 0,
      properties: properties.count ?? 0,
    };
  });

/** Properties and their saved rooms, for the Save Room picker. */
export const listRoomTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("properties")
      .select("id, address, created_at, projects ( id, name, rooms ( id, name, room_type ) )")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => ({
      id: p.id as string,
      address: propLabel(p.address),
      project_id: ((p.projects ?? [])[0]?.id ?? null) as string | null,
      rooms: (p.projects ?? []).flatMap((pr: any) =>
        (pr.rooms ?? []).map((r: any) => ({
          id: r.id as string,
          name: r.name as string,
          room_type: r.room_type as string,
          project_id: pr.id as string,
        })),
      ),
    }));
  });
