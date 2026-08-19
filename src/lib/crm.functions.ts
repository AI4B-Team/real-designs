import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * CRM sync — connect a CRM, pull contacts, and push finished videos,
 * presentations and designs back into the CRM timeline.
 *
 * Credentials never leave the server: reads mask them, and every outbound
 * call happens inside these handlers.
 */

const Provider = z.enum(["followupboss", "hubspot", "webhook"]);

const mask = (row: any) => ({
  id: row.id,
  provider: row.provider,
  label: row.label,
  endpoint: row.endpoint,
  status: row.status,
  account_name: row.account_name,
  auto_push: row.auto_push,
  last_synced_at: row.last_synced_at,
  last_error: row.last_error,
  key_hint: row.credential ? `••••${String(row.credential).slice(-4)}` : null,
});

export const listCrm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [conns, contacts, log] = await Promise.all([
      supabase.from("crm_connections").select("*").order("created_at", { ascending: true }),
      supabase
        .from("crm_contacts")
        .select("*")
        .order("last_activity_at", { ascending: false })
        .limit(200),
      supabase.from("crm_sync_log").select("*").order("created_at", { ascending: false }).limit(25),
    ]);
    if (conns.error) throw new Error(conns.error.message);
    return {
      connections: (conns.data ?? []).map(mask),
      contacts: contacts.data ?? [],
      log: log.data ?? [],
    };
  });

export const connectCrm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: Provider,
        credential: z.string().min(6).max(400),
        endpoint: z.string().max(400).nullable().optional(),
        label: z.string().max(80).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { verifyCrm, CRM_LABELS } = await import("@/lib/crm.server");
    const check = await verifyCrm(data.provider, data.credential, data.endpoint ?? null);
    const row = {
      user_id: userId,
      provider: data.provider,
      label: data.label || CRM_LABELS[data.provider],
      credential: data.credential,
      endpoint: data.endpoint ?? null,
      status: "connected",
      account_name: check.account,
      last_error: null,
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = await supabase
      .from("crm_connections")
      .upsert(row as any, { onConflict: "user_id,provider" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("crm_sync_log").insert({
      user_id: userId,
      connection_id: saved.id,
      action: "connect",
      status: "ok",
      detail: check.account ? `Connected to ${check.account}` : "Connection verified",
    } as any);
    return mask(saved);
  });

export const disconnectCrm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_connections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCrmAutoPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), auto_push: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("crm_connections")
      .update({ auto_push: data.auto_push, updated_at: new Date().toISOString() } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncCrmContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: conn, error } = await supabase
      .from("crm_connections")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !conn) throw new Error("That CRM connection is no longer available.");
    const { fetchCrmContacts } = await import("@/lib/crm.server");
    try {
      const people = await fetchCrmContacts(conn.provider as any, conn.credential as string, 100);
      if (people.length) {
        const rows = people.map((p) => ({
          ...p,
          user_id: userId,
          connection_id: conn.id,
          updated_at: new Date().toISOString(),
        }));
        const up = await supabase
          .from("crm_contacts")
          .upsert(rows as any, { onConflict: "connection_id,external_id" });
        if (up.error) throw new Error(up.error.message);
      }
      await supabase
        .from("crm_connections")
        .update({
          last_synced_at: new Date().toISOString(),
          last_error: null,
          status: "connected",
        } as any)
        .eq("id", conn.id);
      await supabase.from("crm_sync_log").insert({
        user_id: userId,
        connection_id: conn.id,
        action: "sync_contacts",
        status: "ok",
        detail: `${people.length} contact${people.length === 1 ? "" : "s"} synced`,
      } as any);
      return { synced: people.length };
    } catch (e: any) {
      const msg = String(e?.message || e).slice(0, 300);
      await supabase
        .from("crm_connections")
        .update({ status: "error", last_error: msg } as any)
        .eq("id", conn.id);
      await supabase.from("crm_sync_log").insert({
        user_id: userId,
        connection_id: conn.id,
        action: "sync_contacts",
        status: "error",
        detail: msg,
      } as any);
      throw new Error(msg);
    }
  });

export const pushToCrm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        connectionId: z.string().uuid(),
        contactId: z.string().uuid().nullable().optional(),
        title: z.string().min(1).max(160),
        body: z.string().max(2000).default(""),
        link: z.string().max(600).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: conn, error } = await supabase
      .from("crm_connections")
      .select("*")
      .eq("id", data.connectionId)
      .single();
    if (error || !conn) throw new Error("That CRM connection is no longer available.");
    let contact: any = null;
    if (data.contactId) {
      const c = await supabase.from("crm_contacts").select("*").eq("id", data.contactId).single();
      contact = c.data ?? null;
    }
    const { pushCrm } = await import("@/lib/crm.server");
    try {
      const out = await pushCrm(
        conn.provider as any,
        conn.credential as string,
        {
          title: data.title,
          body: data.body || "",
          link: data.link ?? null,
          contactExternalId: contact?.external_id ?? null,
          contactEmail: contact?.email ?? null,
        },
        conn.endpoint,
      );
      await supabase.from("crm_sync_log").insert({
        user_id: userId,
        connection_id: conn.id,
        action: "push",
        status: "ok",
        detail: `${data.title} — ${out.detail}`,
      } as any);
      return { ok: true, detail: out.detail };
    } catch (e: any) {
      const msg = String(e?.message || e).slice(0, 300);
      await supabase.from("crm_sync_log").insert({
        user_id: userId,
        connection_id: conn.id,
        action: "push",
        status: "error",
        detail: msg,
      } as any);
      throw new Error(msg);
    }
  });
