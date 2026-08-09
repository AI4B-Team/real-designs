import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Account data portability and deletion.
 *
 * Export reads only through the caller's RLS-scoped client, so it can never
 * return another owner's rows. Deletion removes the owned hierarchy first
 * (RLS scoped), then removes the auth user with the privileged client.
 */

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: properties } = await supabase
      .from("properties")
      .select("id, address, city, state, postal_code, design_dna, created_at")
      .order("created_at", { ascending: true });
    const propIds = (properties ?? []).map((p) => p.id);

    const { data: projects } = propIds.length
      ? await supabase
          .from("projects")
          .select("id, property_id, name, finish_grade, budget_band, budget_target, created_at")
          .in("property_id", propIds)
      : { data: [] as any[] };
    const projIds = (projects ?? []).map((p) => p.id);

    const { data: rooms } = projIds.length
      ? await supabase
          .from("rooms")
          .select(
            "id, project_id, name, room_type, floor_area_sf, wall_area_sf, ceiling_ht_in, perimeter_lf, dims_source, created_at",
          )
          .in("project_id", projIds)
      : { data: [] as any[] };
    const roomIds = (rooms ?? []).map((r) => r.id);

    const { data: versions } = roomIds.length
      ? await supabase
          .from("versions")
          .select("id, room_id, version_no, status, style, before_path, after_path, created_at")
          .in("room_id", roomIds)
      : { data: [] as any[] };
    const verIds = (versions ?? []).map((v) => v.id);

    const { data: changeItems } = verIds.length
      ? await supabase
          .from("change_items")
          .select("id, version_id, action, label, material, grade, qty, uom, csi_division")
          .in("version_id", verIds)
      : { data: [] as any[] };

    const { data: scopes } = verIds.length
      ? await supabase
          .from("scopes")
          .select(
            "id, version_id, total_low, total_high, contingency_pct, layout_conf, pricing_conf, budget_fit, computed_at",
          )
          .in("version_id", verIds)
      : { data: [] as any[] };
    const scopeIds = (scopes ?? []).map((s) => s.id);

    const { data: scopeLines } = scopeIds.length
      ? await supabase
          .from("scope_lines")
          .select("id, scope_id, description, trade, csi_division, qty, uom, line_low, line_high, price_source")
          .in("scope_id", scopeIds)
      : { data: [] as any[] };

    const { data: presentations } = verIds.length
      ? await supabase
          .from("presentations")
          .select("id, version_id, title, client_name, client_email, status, view_count, decision_note, created_at")
          .in("version_id", verIds)
      : { data: [] as any[] };

    const { data: ledger } = await supabase
      .from("credit_ledger")
      .select("action, delta, balance_after, note, created_at")
      .order("created_at", { ascending: true });

    return {
      exported_at: new Date().toISOString(),
      user_id: userId,
      properties: properties ?? [],
      projects: projects ?? [],
      rooms: rooms ?? [],
      versions: versions ?? [],
      change_items: changeItems ?? [],
      scopes: scopes ?? [],
      scope_lines: scopeLines ?? [],
      presentations: presentations ?? [],
      credit_ledger: ledger ?? [],
    };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Owned hierarchy cascades from properties.
    const { error: delErr } = await supabase.from("properties").delete().eq("owner_id", userId);
    if (delErr) throw new Error(delErr.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("feedback").delete().eq("user_id", userId);
    await supabaseAdmin.from("credit_ledger").delete().eq("user_id", userId);
    await supabaseAdmin.from("credit_accounts").delete().eq("user_id", userId);
    await supabaseAdmin.storage.from("room-photos").remove([`${userId}/`]).catch?.(() => {});

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
