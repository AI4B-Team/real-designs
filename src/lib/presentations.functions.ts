import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Owner: every share link created from their own saved versions, newest first. */
export const listPresentations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("presentations")
      .select(
        `id, title, client_name, client_email, token, status, view_count, last_viewed_at,
         decision_note, decided_at, created_at,
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
      created_at: p.created_at as string,
      address: p.versions.rooms.projects.properties.address as string,
      project_name: p.versions.rooms.projects.name as string,
      room_name: p.versions.rooms.name as string,
      version_no: (p.versions.version_no ?? 1) as number,
    }));
  });

export const createPresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        version_id: z.string().uuid(),
        title: z.string().trim().min(1).max(120),
        client_name: z.string().trim().max(120).optional(),
        client_email: z.string().trim().email().max(160).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("presentations")
      .insert({
        version_id: data.version_id,
        title: data.title,
        client_name: data.client_name || null,
        client_email: data.client_email || null,
      })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, token: row.token as string };
  });

export const deletePresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("presentations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- public share link ---------------- */

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const tokenSchema = z.object({ token: z.string().trim().regex(/^[a-f0-9]{16,64}$/i) });

/** Public: read one presentation by its share token and register the view. */
export const getSharedPresentation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const client = await publicClient();
    const { data: payload, error } = await client.rpc("get_shared_presentation", { _token: data.token });
    if (error) throw new Error(error.message);
    if (!payload) return null;

    await client.rpc("record_presentation_view", { _token: data.token });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sign = async (path: string | null) => {
      if (!path || /^(https?:|\/|data:)/.test(path)) return path;
      const { data: signed } = await supabaseAdmin.storage.from("room-photos").createSignedUrl(path, 3600);
      return signed?.signedUrl ?? null;
    };

    const p = payload as any;
    return {
      title: p.title as string,
      client_name: (p.client_name ?? null) as string | null,
      status: (p.status ?? "sent") as string,
      decision_note: (p.decision_note ?? null) as string | null,
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
        description: String(l.description),
        trade: String(l.trade ?? ""),
        qty: Number(l.qty ?? 0),
        uom: String(l.uom ?? ""),
        low: Number(l.low ?? 0),
        high: Number(l.high ?? 0),
      })),
      before_url: await sign((p.before_path ?? null) as string | null),
      after_url: await sign((p.after_path ?? null) as string | null),
    };
  });

/** Public: the client's Approve / Request Changes decision. */
export const respondToPresentation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    tokenSchema
      .extend({
        decision: z.enum(["approved", "changes"]),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const client = await publicClient();
    const { data: res, error } = await client.rpc("respond_to_presentation", {
      _token: data.token,
      _decision: data.decision,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; status?: string; reason?: string };
  });
