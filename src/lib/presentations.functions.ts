import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  presentationCreateSchema,
  presentationIdSchema,
  presentationRespondSchema,
  presentationTokenSchema,
} from "@/lib/presentations.schemas";

/** Owner: every share link created from their own saved versions, newest first. */
export const listPresentations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("presentations")
      .select(
        `id, title, client_name, client_email, token, status, view_count, last_viewed_at,
         decision_note, excluded_lines, line_notes, decided_at, created_at,
         versions!inner ( version_no,
           rooms!inner ( name,
             projects!inner ( name, properties!inner ( address ) ) ) )`,
      )
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);

    return (data ?? []).map((p: any) => ({
      id: p.id as string,
      title: p.title as string,
      client_name: (p.client_name ?? null) as string | null,
      client_email: (p.client_email ?? null) as string | null,
      token: p.token as string,
      status: (p.status ?? "sent") as string,
      view_count: (p.view_count ?? 0) as number,
      last_viewed_at: (p.last_viewed_at ?? null) as string | null,
      decision_note: (p.decision_note ?? null) as string | null,
      excluded_count: Array.isArray(p.excluded_lines) ? (p.excluded_lines as any[]).length : 0,
      line_notes: (p.line_notes && typeof p.line_notes === "object" ? p.line_notes : {}) as Record<string, string>,
      note_count: p.line_notes && typeof p.line_notes === "object" ? Object.keys(p.line_notes).length : 0,
      created_at: p.created_at as string,
      address: p.versions.rooms.projects.properties.address as string,
      project_name: p.versions.rooms.projects.name as string,
      room_name: p.versions.rooms.name as string,
      version_no: (p.versions.version_no ?? 1) as number,
    }));
  });

export const createPresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => presentationCreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("presentations")
      .insert({
        version_id: data.version_id,
        title: data.title,
        client_name: data.client_name || null,
        client_email: data.client_email || null,
        brand_name: data.brand_name || null,
        brand_accent: data.brand_accent || null,
      })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, token: row.token as string };
  });

export const deletePresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => presentationIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("presentations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- public share link ---------------- */

/** Public: read one presentation by its share token and register the view. */
export const getSharedPresentation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => presentationTokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin;
    const { data: payload, error } = await client.rpc("get_shared_presentation", { _token: data.token });
    if (error) throw new Error(error.message);
    if (!payload) return null;

    await client.rpc("record_presentation_view", { _token: data.token });

    const { signRoomPhoto } = await import("@/lib/presentations.server");

    const p = payload as any;
    return {
      title: p.title as string,
      client_name: (p.client_name ?? null) as string | null,
      status: (p.status ?? "sent") as string,
      decision_note: (p.decision_note ?? null) as string | null,
      excluded_lines: ((p.excluded_lines ?? []) as any[]).map(String),
      line_notes: (p.line_notes ?? {}) as Record<string, string>,
      brand_name: (p.brand_name ?? null) as string | null,
      brand_accent: (p.brand_accent ?? null) as string | null,
      address: p.address as string,
      project_name: p.project_name as string,
      room_name: p.room_name as string,
      room_type: (p.room_type ?? "") as string,
      grade: (p.grade ?? "retail") as string,
      style: (p.style ?? null) as string | null,
      version_no: (p.version_no ?? 1) as number,
      created_at: p.created_at as string,
      total_low: p.total_low == null ? null : Number(p.total_low),
      total_high: p.total_high == null ? null : Number(p.total_high),
      lines: ((p.lines ?? []) as any[]).map((l) => ({
        id: String(l.id ?? ""),
        description: String(l.description),
        trade: String(l.trade ?? ""),
        qty: Number(l.qty ?? 0),
        uom: String(l.uom ?? ""),
        low: Number(l.low ?? 0),
        high: Number(l.high ?? 0),
      })),
      before_url: await signRoomPhoto((p.before_path ?? null) as string | null),
      after_url: await signRoomPhoto((p.after_path ?? null) as string | null),
    };
  });

/** Public: the client's Approve / Request Changes decision. */
export const respondToPresentation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => presentationRespondSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin;
    const { data: res, error } = await client.rpc("respond_to_presentation", {
      _token: data.token,
      _decision: data.decision,
      _excluded: data.excluded ?? [],
      _line_notes: data.line_notes ?? {},
      ...(data.note ? { _note: data.note } : {}),
    } as never);
    if (error) throw new Error(error.message);
    return res as { ok: boolean; status?: string; reason?: string };
  });

/**
 * Owner: the full package behind one of their own share links, for the
 * branded PDF export. Ownership is proven by an RLS-scoped read of the
 * presentation row before the payload RPC runs, and no view is recorded.
 */
export const getPresentationPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => presentationIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: own, error: ownErr } = await context.supabase
      .from("presentations")
      .select("token")
      .eq("id", data.id)
      .maybeSingle();
    if (ownErr) throw new Error(ownErr.message);
    if (!own) throw new Error("That presentation is not available.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payload, error } = await supabaseAdmin.rpc("get_shared_presentation", {
      _token: own.token as string,
    });
    if (error) throw new Error(error.message);
    if (!payload) throw new Error("That presentation is not available.");

    const { signRoomPhoto } = await import("@/lib/presentations.server");
    const p = payload as any;
    return {
      title: p.title as string,
      client_name: (p.client_name ?? null) as string | null,
      status: (p.status ?? "sent") as string,
      address: p.address as string,
      project_name: p.project_name as string,
      room_name: p.room_name as string,
      grade: (p.grade ?? "retail") as string,
      style: (p.style ?? null) as string | null,
      version_no: (p.version_no ?? 1) as number,
      created_at: p.created_at as string,
      total_low: p.total_low == null ? null : Number(p.total_low),
      total_high: p.total_high == null ? null : Number(p.total_high),
      lines: ((p.lines ?? []) as any[]).map((l) => ({
        description: String(l.description),
        trade: String(l.trade ?? ""),
        qty: Number(l.qty ?? 0),
        uom: String(l.uom ?? ""),
        low: Number(l.low ?? 0),
        high: Number(l.high ?? 0),
      })),
      before_url: await signRoomPhoto((p.before_path ?? null) as string | null),
      after_url: await signRoomPhoto((p.after_path ?? null) as string | null),
    };
  });
