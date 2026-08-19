/**
 * REAL REVEAL presentation pages — server only.
 *
 * A presentation page is the public face of a video project: the rendered
 * video plus whichever sections the owner switched on. Everything is read with
 * the admin client because visitors are anonymous, so each read is gated by
 * the share link itself (slug or token, expiry, optional password).
 */

const SALT = "real-designs-reveal";

export async function hashSharePassword(plain: string): Promise<string> {
  const bytes = new TextEncoder().encode(SALT + ":" + plain);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signVideo(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from("reveal-videos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export type PresentationPayload = Awaited<ReturnType<typeof loadPresentation>>;

export async function loadPresentation(key: string, password: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const safe = key.replace(/[^a-zA-Z0-9-]/g, "");
  if (!safe) return null;

  const { data: link } = await supabaseAdmin
    .from("video_share_links")
    .select("*")
    .or(`slug.eq.${safe},token.eq.${safe}`)
    .maybeSingle();
  if (!link) return null;
  const l = link as any;

  if (l.expires_at && new Date(l.expires_at).getTime() < Date.now()) {
    return { expired: true as const };
  }
  if (l.password_hash) {
    const ok = password ? (await hashSharePassword(password)) === l.password_hash : false;
    if (!ok) return { locked: true as const, title: (l.page_title as string) || "Private Presentation" };
  }

  const { data: project } = await supabaseAdmin
    .from("video_projects")
    .select("*")
    .eq("id", l.video_project_id)
    .maybeSingle();
  if (!project) return null;
  const p = project as any;

  const [{ data: scenes }, { data: variants }] = await Promise.all([
    supabaseAdmin.from("video_scenes").select("*").eq("video_project_id", p.id).order("sequence"),
    supabaseAdmin.from("video_variants").select("*").eq("video_project_id", p.id),
  ]);

  let brand: any = null;
  if (p.brand_kit_id) {
    const { data } = await supabaseAdmin.from("brand_kits").select("*").eq("id", p.brand_kit_id).maybeSingle();
    brand = data ?? null;
  }

  const sections = {
    address: true,
    video: true,
    before_after: true,
    rooms: true,
    budget: !!l.show_budget,
    products: !!l.show_products,
    brand: true,
    contact: true,
    ...(l.sections && typeof l.sections === "object" ? l.sections : {}),
  } as Record<string, boolean>;

  const ready = (variants ?? []).filter((v: any) => v.render_status === "ready" && v.output_path);
  const pick =
    ready.find((v: any) => v.aspect_ratio === "16:9" && v.version_type === "branded") ||
    ready.find((v: any) => v.aspect_ratio === "16:9") ||
    ready[0] ||
    null;

  const { signRoomPhoto } = await import("@/lib/presentations.server");
  const sceneOut = [] as Array<{
    room_name: string;
    scene_type: string;
    caption: string | null;
    disclosure_type: string | null;
    after_url: string | null;
    before_url: string | null;
  }>;
  for (const s of (scenes ?? []) as any[]) {
    sceneOut.push({
      room_name: s.room_name || "",
      scene_type: s.scene_type,
      caption: s.caption ?? null,
      disclosure_type: s.disclosure_type ?? null,
      after_url: await signRoomPhoto(s.source_path ?? null),
      before_url: await signRoomPhoto(s.compare_path ?? null),
    });
  }

  // Budget only exists when the video is tied to a saved design version.
  let budget: { low: number; high: number; lines: Array<{ description: string; trade: string; low: number; high: number }> } | null = null;
  const { checkBudgetsAvailable } = await import("@/lib/budget.server");
  const budgetsAvailable = await checkBudgetsAvailable();
  if (budgetsAvailable && sections["budget"] && p.design_version_id) {
    const { data: scope } = await supabaseAdmin
      .from("scopes")
      .select("id, total_low, total_high")
      .eq("version_id", p.design_version_id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (scope) {
      const { data: lines } = await supabaseAdmin
        .from("scope_lines")
        .select("description, trade, line_low, line_high")
        .eq("scope_id", (scope as any).id)
        .limit(80);
      budget = {
        low: Number((scope as any).total_low ?? 0),
        high: Number((scope as any).total_high ?? 0),
        lines: (lines ?? []).map((x: any) => ({
          description: String(x.description),
          trade: String(x.trade ?? ""),
          low: Number(x.line_low ?? 0),
          high: Number(x.line_high ?? 0),
        })),
      };
    }
  }

  await supabaseAdmin
    .from("video_share_links")
    .update({ view_count: Number(l.view_count ?? 0) + 1 })
    .eq("id", l.id);

  return {
    locked: false as const,
    expired: false as const,
    presentation_type: (l.presentation_type ?? "listing") as string,
    title: (l.page_title as string) || (p.title as string),
    headline: (l.headline ?? null) as string | null,
    address: sections["address"] ? ((p.property_label ?? null) as string | null) : null,
    mobile_layout: (l.mobile_layout ?? "stacked") as string,
    allow_download: !!l.allow_download,
    comments_enabled: !!l.comments_enabled,
    approval_enabled: !!l.approval_enabled,
    show_project_details: !!l.show_project_details,
    sections,
    video_url: sections["video"] ? await signVideo(pick?.output_path ?? null) : null,
    aspect: (pick?.aspect_ratio ?? "16:9") as string,
    scenes: sceneOut,
    budget,
    brand: brand
      ? {
          company_name: (brand.company_name ?? null) as string | null,
          contact_name: (brand.contact_name ?? null) as string | null,
          logo_url: (brand.logo_url ?? null) as string | null,
          phone: (brand.phone ?? null) as string | null,
          email: (brand.email ?? null) as string | null,
          website: (brand.website ?? null) as string | null,
          default_cta: (brand.default_cta ?? null) as string | null,
          accent: (brand.colors?.primary ?? null) as string | null,
        }
      : null,
  };
}
