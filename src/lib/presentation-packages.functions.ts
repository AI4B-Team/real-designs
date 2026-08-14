import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  pkgIdSchema,
  pkgSaveSchema,
  pkgLinkSchema,
  pkgShareTokenSchema,
  pkgCommentSchema,
  pkgDecisionSchema,
} from "@/lib/presentation-packages.schemas";

/** Owner: every presentation package in the workspace, newest first. */
export const listPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("presentation_packages")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((p: any) => p.id);
    let links: any[] = [];
    let assets: any[] = [];
    if (ids.length) {
      const [l, a] = await Promise.all([
        context.supabase
          .from("presentation_links")
          .select("id, package_id, token, revoked, view_count, last_viewed_at, expires_at, access_code, created_at")
          .in("package_id", ids),
        context.supabase.from("presentation_assets").select("id, package_id, section_key").in("package_id", ids),
      ]);
      links = l.data ?? [];
      assets = a.data ?? [];
    }
    return (data ?? []).map((p: any) => ({
      ...p,
      links: links.filter((l) => l.package_id === p.id),
      asset_count: assets.filter((a) => a.package_id === p.id).length,
    }));
  });

/** Owner: one package with its sections, assets, links, comments and activity. */
export const getPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pkgIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: pkg, error } = await supabase
      .from("presentation_packages")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pkg) throw new Error("That presentation is not available.");
    const [s, a, l, c, act] = await Promise.all([
      supabase.from("presentation_sections").select("*").eq("package_id", data.id).order("sort_order"),
      supabase.from("presentation_assets").select("*").eq("package_id", data.id).order("sort_order"),
      supabase.from("presentation_links").select("*").eq("package_id", data.id).order("created_at", { ascending: false }),
      supabase.from("presentation_comments").select("*").eq("package_id", data.id).order("created_at"),
      supabase
        .from("presentation_activity")
        .select("*")
        .eq("package_id", data.id)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);
    return {
      package: pkg,
      sections: s.data ?? [],
      assets: a.data ?? [],
      links: l.data ?? [],
      comments: c.data ?? [],
      activity: act.data ?? [],
    };
  });

/** Owner: create or update a package, replacing its sections and assets. */
export const savePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pkgSaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const meta = {
      user_id: userId,
      title: data.title,
      property_id: data.property_id ?? null,
      property_label: data.property_label ?? null,
      project_name: data.project_name ?? null,
      client_name: data.client_name ?? null,
      client_email: data.client_email || null,
      intro: data.intro ?? null,
      logo_url: data.logo_url ?? null,
      accent: data.accent ?? "#CC0000",
      cover_url: data.cover_url ?? null,
      ...(data.status ? { status: data.status } : {}),
      ...(data.settings ? { settings: data.settings } : {}),
    };

    let id = data.id ?? null;
    if (id) {
      const { error } = await supabase.from("presentation_packages").update(meta).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabase.from("presentation_packages").insert(meta).select("id").single();
      if (error) throw new Error(error.message);

      id = row.id as string;
      await supabase
        .from("presentation_activity")
        .insert({ package_id: id, user_id: userId, kind: "created", detail: "Presentation created" });
    }

    if (data.sections) {
      await supabase.from("presentation_sections").delete().eq("package_id", id);
      const rows = data.sections.map((s, i) => ({
        package_id: id,
        user_id: userId,
        section_key: s.section_key,
        title: s.title,
        hidden: s.hidden ?? false,
        sort_order: s.sort_order ?? i,
      }));
      if (rows.length) {
        const { error } = await supabase.from("presentation_sections").insert(rows);
        if (error) throw new Error(error.message);
      }
    }

    if (data.assets) {
      await supabase.from("presentation_assets").delete().eq("package_id", id);
      const rows = data.assets.map((a, i) => ({
        package_id: id,
        user_id: userId,
        section_key: a.section_key,
        kind: a.kind,
        title: a.title ?? null,
        caption: a.caption ?? null,
        url: a.url ?? null,
        compare_url: a.compare_url ?? null,
        source_id: a.source_id ?? null,
        meta: a.meta ?? {},
        sort_order: a.sort_order ?? i,
      }));
      if (rows.length) {
        const { error } = await supabase.from("presentation_assets").insert(rows);
        if (error) throw new Error(error.message);
      }
    }

    await supabase
      .from("presentation_packages")
      .update({ last_activity: "Presentation updated", last_activity_at: new Date().toISOString() })
      .eq("id", id);

    return { id: id as string };
  });

/** Owner: archive one package so it leaves the library. */
export const deletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pkgIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("presentation_packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner: mint a client share link for one package. */
export const createPackageLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pkgLinkSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const expires =
      data.expires_days == null ? null : new Date(Date.now() + data.expires_days * 86400000).toISOString();
    const { data: row, error } = await supabase
      .from("presentation_links")
      .insert({
        package_id: data.package_id,
        user_id: userId,
        access_code: data.access_code || null,
        expires_at: expires,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabase
      .from("presentation_packages")
      .update({ status: "shared", last_activity: "Share link created", last_activity_at: new Date().toISOString() })
      .eq("id", data.package_id);
    await supabase
      .from("presentation_activity")
      .insert({ package_id: data.package_id, user_id: userId, kind: "shared", detail: "Share link created" });
    return row;
  });

/** Owner: revoke a share link without deleting its history. */
export const revokePackageLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pkgIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("presentation_links").update({ revoked: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public: the client-facing package behind a share token. */
export const getSharedPackage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => pkgShareTokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payload, error } = await supabaseAdmin.rpc("get_presentation_share", {
      _token: data.token,
      _code: data.code ?? null,
    } as never);
    if (error) throw new Error(error.message);
    const p = (payload ?? {}) as any;
    if (p.error) return p as { error: string };
    await supabaseAdmin.rpc("record_presentation_share_view", { _token: data.token } as never);
    const { signRoomPhoto } = await import("@/lib/presentations.server");
    p.assets = await Promise.all(
      (Array.isArray(p.assets) ? p.assets : []).map(async (a: any) => ({
        ...a,
        url: await signRoomPhoto(a.url ?? null),
        compare_url: await signRoomPhoto(a.compare_url ?? null),
      })),
    );
    return p;

  });

/** Public: a client comment on one section of a shared package. */
export const commentOnPackage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => pkgCommentSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("add_presentation_comment", {
      _token: data.token,
      _section: data.section ?? null,
      _name: data.name ?? null,
      _body: data.body,
    } as never);
    if (error) throw new Error(error.message);
    return res as { ok: boolean; reason?: string };
  });

/** Public: the client's approve / request-changes decision. */
export const decideOnPackage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => pkgDecisionSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("decide_presentation_share", {
      _token: data.token,
      _decision: data.decision,
      _name: data.name ?? null,
      _note: data.note ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return res as { ok: boolean; status?: string; reason?: string };
  });
