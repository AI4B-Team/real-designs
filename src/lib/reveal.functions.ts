import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * REAL REVEAL — property video and marketing content.
 *
 * Videos never copy property imagery: a scene points back at the same storage
 * path already stored on the property asset / room version it came from.
 * Rendering itself happens in the browser (canvas + MediaRecorder), so these
 * functions only own persistence, credit metering and share links.
 */

const SceneInput = z.object({
  id: z.string().uuid().optional(),
  source_asset_id: z.string().uuid().nullable().optional(),
  source_version_id: z.string().uuid().nullable().optional(),
  source_path: z.string().max(600).nullable().optional(),
  compare_path: z.string().max(600).nullable().optional(),
  room_name: z.string().max(120).nullable().optional(),
  sequence: z.number().int().min(0).max(400).default(0),
  scene_type: z.string().max(40).default("design"),
  duration: z.number().min(0.5).max(20).default(3),
  motion: z.string().max(30).default("auto"),
  crop_data: z.record(z.string(), z.any()).default({}),
  transition: z.string().max(30).default("clean"),
  caption: z.string().max(300).nullable().optional(),
  disclosure_type: z.string().max(40).nullable().optional(),
  motion_level: z.enum(["standard", "immersive"]).default("standard"),
  immersive_effect: z.string().max(40).nullable().optional(),
  exterior_effect: z.string().max(40).nullable().optional(),
  labels: z
    .array(
      z.object({
        text: z.string().max(80),
        style: z.enum(["clean", "architectural", "callout"]).default("clean"),
        position: z.enum(["top_left", "top_right", "bottom_left", "bottom_right"]).default("bottom_left"),
      }),
    )
    .max(3)
    .default([]),
});

const ProjectInput = z.object({
  id: z.string().uuid().optional(),
  property_id: z.string().uuid().nullable().optional(),
  property_label: z.string().max(200).nullable().optional(),
  /* Optional project address. Structured parts plus a formatted snapshot so a
     project keeps its address even if the property record changes later. */
  property_address: z.string().max(200).nullable().optional(),
  address_line_1: z.string().max(200).nullable().optional(),
  address_line_2: z.string().max(60).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  state: z.string().max(40).nullable().optional(),
  postal_code: z.string().max(20).nullable().optional(),
  country: z.string().max(60).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  normalized_address: z.string().max(400).nullable().optional(),
  address_source: z.enum(["manual", "autocomplete", "existing_property", "listing_import", "inherited", "unknown"]).optional(),
  address_verified_at: z.string().max(40).nullable().optional(),
  title_touched: z.boolean().optional(),
  room_id: z.string().uuid().nullable().optional(),
  design_version_id: z.string().uuid().nullable().optional(),
  title: z.string().max(160).default("Untitled Reveal"),
  video_type: z.string().max(40).default("property_tour"),
  source_type: z.string().max(40).default("property"),
  status: z.string().max(30).default("draft"),
  formats: z.array(z.string().max(10)).max(4).default(["9:16"]),
  length_preset: z.string().max(20).default("standard"),
  transition: z.string().max(30).default("clean"),
  motion: z.string().max(30).default("auto"),
  brand_kit_id: z.string().uuid().nullable().optional(),
  branding: z.record(z.string(), z.any()).default({}),
  disclosure: z.record(z.string(), z.any()).default({}),
  settings: z.record(z.string(), z.any()).default({}),
});

const AudioInput = z.object({
  presentation_style: z.string().max(30).default("music"),
  music_track_id: z.string().max(60).nullable().optional(),
  music_volume: z.number().min(0).max(1).default(0.6),
  beat_sync: z.boolean().default(true),
  narration_type: z.string().max(30).default("none"),
  narration_script: z.string().max(4000).nullable().optional(),
  voice_id: z.string().max(40).nullable().optional(),
  captions_enabled: z.boolean().default(false),
});

/** Library listing: every video with its scene count and rendered variants. */
export const listVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: projects, error } = await supabase
      .from("video_projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = (projects ?? []).map((p: any) => p.id);
    let variants: any[] = [];
    let scenes: any[] = [];
    let shares: any[] = [];
    if (ids.length) {
      const [v, s, sh] = await Promise.all([
        supabase.from("video_variants").select("*").in("video_project_id", ids),
        supabase
          .from("video_scenes")
          .select("id, video_project_id, source_path, sequence, duration")
          .in("video_project_id", ids),
        supabase.from("video_share_links").select("id, video_project_id, token").in("video_project_id", ids),
      ]);
      variants = v.data ?? [];
      scenes = s.data ?? [];
      shares = sh.data ?? [];
    }
    return { projects: projects ?? [], variants, scenes, shares };
  });

export const getVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: project, error } = await supabase
      .from("video_projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("That video no longer exists.");
    const [s, v, a, sh] = await Promise.all([
      supabase.from("video_scenes").select("*").eq("video_project_id", data.id).order("sequence"),
      supabase.from("video_variants").select("*").eq("video_project_id", data.id),
      supabase.from("video_audio").select("*").eq("video_project_id", data.id).maybeSingle(),
      supabase.from("video_share_links").select("*").eq("video_project_id", data.id).maybeSingle(),
    ]);
    return { project, scenes: s.data ?? [], variants: v.data ?? [], audio: a.data ?? null, share: sh.data ?? null };
  });

/** Create or update a video project together with its full scene list and audio. */
export const saveVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        project: ProjectInput,
        scenes: z.array(SceneInput).max(200).optional(),
        audio: AudioInput.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const p: any = { ...data.project, user_id: userId, updated_at: new Date().toISOString() };
    /* Never trust a client-supplied property_id: confirm the signed-in user can
       actually read that property before linking the project to it. */
    if (p.property_id) {
      const { data: prop } = await supabase.from("properties").select("id, address").eq("id", p.property_id).maybeSingle();
      if (!prop) throw new Error("That property is not available on this account.");
      if (!p.property_label) p.property_label = (prop as any).address ?? null;
    }
    let projectId = data.project.id ?? null;

    if (projectId) {
      delete p.id;
      const { error } = await supabase.from("video_projects").update(p).eq("id", projectId);
      if (error) throw new Error(error.message);
    } else {
      delete p.id;
      const { data: row, error } = await supabase.from("video_projects").insert(p).select("id").single();
      if (error) throw new Error(error.message);
      projectId = row.id as string;
    }

    if (data.scenes) {
      await supabase.from("video_scenes").delete().eq("video_project_id", projectId);
      if (data.scenes.length) {
        const rows = data.scenes.map((s, i) => {
          const row: any = { ...s, user_id: userId, video_project_id: projectId, sequence: i };
          delete row.id;
          return row;
        });
        const { error } = await supabase.from("video_scenes").insert(rows);
        if (error) throw new Error(error.message);
      }
    }

    if (data.audio) {
      const row: any = { ...data.audio, user_id: userId, video_project_id: projectId, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("video_audio").upsert(row, { onConflict: "video_project_id" });
      if (error) throw new Error(error.message);
    }

    return { id: projectId as string };
  });

export const setVideoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum([
          "draft",
          "uploading",
          "selecting",
          "configuring",
          "awaiting_credits",
          "queued",
          "processing",
          "ready",
          "failed",
          "archived",
        ]),
        error_message: z.string().max(400).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("video_projects")
      .update({ status: data.status, error_message: data.error_message ?? null, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("video_projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Copy a video and its scenes into a fresh draft. */
export const duplicateVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src, error } = await supabase.from("video_projects").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!src) throw new Error("That video no longer exists.");
    const copy: any = { ...src, title: `${src.title} Copy`, status: "draft", error_message: null };
    delete copy.id;
    delete copy.created_at;
    copy.user_id = userId;
    const { data: row, error: iErr } = await supabase.from("video_projects").insert(copy).select("id").single();
    if (iErr) throw new Error(iErr.message);

    const { data: scenes } = await supabase.from("video_scenes").select("*").eq("video_project_id", data.id);
    if (scenes?.length) {
      const rows = scenes.map((s: any) => {
        const c = { ...s, video_project_id: row.id, generation_status: "pending" };
        delete c.id;
        delete c.created_at;
        return c;
      });
      await supabase.from("video_scenes").insert(rows);
    }
    return { id: row.id as string };
  });

/**
 * Charge the render before any pixels are produced. One "video" credit event
 * per render request, no matter how many formats come out of the master.
 */
export const startRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        quality: z.string().max(30).optional(),
        scene_count: z.number().int().min(0).max(400).optional(),
        output_formats: z.array(z.string().max(10)).max(6).optional(),
        variants: z
          .array(
            z.object({
              aspect_ratio: z.enum(["9:16", "16:9", "1:1", "4:5"]),
              version_type: z.enum(["branded", "clean", "disclosure"]),
              brand_kit_id: z.string().uuid().nullable().optional(),
            }),
          )
          .min(1)
          .max(12),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isJobStale, DEFAULT_RENDER_PROVIDER } = await import("@/lib/render-providers");

    // One live job per video. A duplicate request while a render is genuinely
    // running is returned as-is so the user is never charged twice; a job whose
    // owner stopped reporting progress (tab closed, crash) is retired first.
    const { data: live } = await supabase
      .from("video_render_jobs")
      .select("*")
      .eq("video_project_id", data.id)
      .in("status", ["queued", "rendering"])
      .maybeSingle();
    if (live) {
      if (!isJobStale(live as any)) {
        const { data: existing } = await supabase.from("video_variants").select("*").eq("video_project_id", data.id);
        return { variants: existing ?? [], balance: null, job: live, reused: true };
      }
      await supabase
        .from("video_render_jobs")
        .update({
          status: "failed",
          error_message: "The render stopped before it finished.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", (live as any).id);
    }

    const { charge, chargeErrorMessage, CREDIT_COSTS } = await import("@/lib/credits.server");
    const charged = await charge(userId, "video", "REAL REVEAL render");
    if (!charged.ok)
      throw new Error(
        charged.reason === "plan_required"
          ? `Not enough credits. Rendering a video costs ${CREDIT_COSTS.video} credits and is not part of the free plan.`
          : chargeErrorMessage(charged),
      );


    // Immersive motion is animated per scene, so it is metered per scene on top
    // of the render itself. Standard motion stays inside the render charge.
    let balance = charged.balance;
    let spent = charged.charged;
    const { data: immersive } = await supabase
      .from("video_scenes")
      .select("id, room_name")
      .eq("video_project_id", data.id)
      .eq("motion_level", "immersive");
    for (const s of immersive ?? []) {
      const extra = await charge(userId, "plan_3d", `REAL REVEAL immersive motion — ${(s as any).room_name || "Scene"}`);
      if (!extra.ok) {
        // Never keep a partial debit for a render that will not happen.
        const { refund } = await import("@/lib/credits.server");
        await refund(userId, spent, "REAL REVEAL render could not be started");
        throw new Error(chargeErrorMessage(extra));
      }
      spent += extra.charged;
      balance = extra.balance;
    }



    await supabase.from("video_variants").delete().eq("video_project_id", data.id);
    const rows = data.variants.map((v) => ({
      aspect_ratio: v.aspect_ratio,
      version_type: v.version_type,
      brand_kit_id: v.brand_kit_id ?? null,
      user_id: userId,
      video_project_id: data.id,
      render_status: "queued",
      credit_cost: 0,
    }));
    const { data: out, error } = await supabase.from("video_variants").insert(rows).select("*");
    if (error) throw new Error(error.message);
    await supabase
      .from("video_projects")
      .update({ status: "processing", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    const nowIso = new Date().toISOString();
    const { data: job, error: jobErr } = await supabase
      .from("video_render_jobs")
      .insert({
        user_id: userId,
        video_project_id: data.id,
        provider: DEFAULT_RENDER_PROVIDER,
        status: "queued",
        progress: 0,
        stage: "Preparing scenes",
        output_formats: data.output_formats ?? Array.from(new Set(data.variants.map((v) => v.aspect_ratio))),
        quality: data.quality ?? null,
        scene_count: data.scene_count ?? 0,
        credits_charged: spent,
        heartbeat_at: nowIso,
        started_at: nowIso,
      })
      .select("*")
      .single();
    if (jobErr) throw new Error(jobErr.message);

    return { variants: out ?? [], balance, job, reused: false };
  });

/* ===================== PERSISTENT RENDER JOBS =====================
   The job row is the truth about a render: it survives refreshes, keeps the
   stage and progress, and is provider-agnostic so a server-side renderer can
   take over later without touching this shape. */

/** Every job that still matters to the user: live ones plus recent outcomes. */
export const listRenderJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("video_render_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getRenderJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().optional(), video_project_id: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("video_render_jobs").select("*");
    if (data.id) q = q.eq("id", data.id);
    else if (data.video_project_id) q = q.eq("video_project_id", data.video_project_id);
    else throw new Error("A job id or video is required.");
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

/** Progress, stage and terminal states. Also doubles as the heartbeat. */
export const updateRenderJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["queued", "rendering", "completed", "failed", "cancelled"]).optional(),
        progress: z.number().min(0).max(1).optional(),
        stage: z.string().max(120).nullable().optional(),
        error_message: z.string().max(400).nullable().optional(),
        provider_job_id: z.string().max(200).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { heartbeat_at: new Date().toISOString() };
    if (data.status) patch['status'] = data.status;
    if (data.progress != null) patch['progress'] = data.progress;
    if (data.stage !== undefined) patch['stage'] = data.stage;
    if (data.error_message !== undefined) patch['error_message'] = data.error_message;
    if (data.provider_job_id !== undefined) patch['provider_job_id'] = data.provider_job_id;
    if (data.status === "completed") {
      patch['completed_at'] = new Date().toISOString();
      patch['progress'] = 1;
    }
    if (data.status === "failed" || data.status === "cancelled") patch['completed_at'] = new Date().toISOString();

    const { data: row, error } = await context.supabase
      .from("video_render_jobs")
      .update(patch as any)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

/** Mark one rendered output complete (or failed) once the browser finishes it. */
export const finishVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        variant_id: z.string().uuid(),
        render_status: z.enum(["ready", "failed"]),
        output_path: z.string().max(600).nullable().optional(),
        thumbnail_path: z.string().max(600).nullable().optional(),
        duration: z.number().min(0).max(600).nullable().optional(),
        resolution: z.string().max(20).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      render_status: data.render_status,
      output_path: data.output_path ?? null,
      thumbnail_path: data.thumbnail_path ?? null,
      duration: data.duration ?? null,
      resolution: data.resolution ?? null,
    };
    const { error } = await context.supabase.from("video_variants").update(patch as any).eq("id", data.variant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================ BRAND KITS ============================= */

const BrandKitInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().max(80).default("Brand Kit"),
  kit_type: z.enum(["personal", "company", "client"]).default("personal"),
  company_name: z.string().max(120).nullable().optional(),
  logo_url: z.string().max(600).nullable().optional(),
  profile_photo_url: z.string().max(600).nullable().optional(),
  colors: z.record(z.string(), z.any()).default({}),
  font: z.string().max(60).nullable().optional(),
  contact_name: z.string().max(120).nullable().optional(),
  email: z.string().max(160).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  social_links: z.record(z.string(), z.any()).default({}),
  default_cta: z.string().max(160).nullable().optional(),
  intro_enabled: z.boolean().default(false),
  outro_enabled: z.boolean().default(true),
  is_default: z.boolean().default(false),
});

export const listBrandKits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("brand_kits")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveBrandKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BrandKitInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row: any = { ...data, user_id: userId, updated_at: new Date().toISOString() };
    delete row.id;
    let id = data.id ?? null;
    if (id) {
      const { error } = await supabase.from("brand_kits").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: out, error } = await supabase.from("brand_kits").insert(row).select("id").single();
      if (error) throw new Error(error.message);
      id = out.id as string;
    }
    if (data.is_default && id) {
      await supabase.from("brand_kits").update({ is_default: false }).neq("id", id);
    }
    return { id: id as string };
  });

export const deleteBrandKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("brand_kits").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ==================== PRESENTATION PAGES ==================== */

const SectionsInput = z
  .object({
    address: z.boolean().default(true),
    video: z.boolean().default(true),
    before_after: z.boolean().default(true),
    rooms: z.boolean().default(true),
    budget: z.boolean().default(false),
    products: z.boolean().default(false),
    brand: z.boolean().default(true),
    contact: z.boolean().default(true),
  })
  .partial()
  .default({});

/** Create or update the presentation page behind one video. */
export const saveShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        video_project_id: z.string().uuid(),
        presentation_type: z.enum(["listing", "design", "renovation", "portfolio"]).default("listing"),
        slug: z
          .string()
          .max(60)
          .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and hyphens only.")
          .nullable()
          .optional(),
        page_title: z.string().max(160).nullable().optional(),
        headline: z.string().max(240).nullable().optional(),
        privacy_type: z.enum(["public", "private"]).default("public"),
        password: z.string().max(80).nullable().optional(),
        clear_password: z.boolean().default(false),
        expires_at: z.string().max(40).nullable().optional(),
        allow_download: z.boolean().default(true),
        show_project_details: z.boolean().default(true),
        show_products: z.boolean().default(false),
        show_budget: z.boolean().default(false),
        comments_enabled: z.boolean().default(false),
        approval_enabled: z.boolean().default(false),
        mobile_layout: z.enum(["stacked", "compact"]).default("stacked"),
        sections: SectionsInput,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("video_share_links")
      .select("id, token, password_hash")
      .eq("video_project_id", data.video_project_id)
      .maybeSingle();

    const token = (existing as any)?.token ?? crypto.randomUUID().replace(/-/g, "");
    const { hashSharePassword } = await import("@/lib/reveal.server");

    const row: any = { ...data, user_id: userId, token };
    delete row.password;
    delete row.clear_password;
    row.slug = data.slug ? data.slug.replace(/^-+|-+$/g, "") || null : null;
    if (data.clear_password) row.password_hash = null;
    else if (data.password) row.password_hash = await hashSharePassword(data.password);

    if (existing) {
      const { error } = await supabase.from("video_share_links").update(row).eq("id", (existing as any).id);
      if (error) throw new Error(error.message.includes("slug") ? "That link name is already taken." : error.message);
    } else {
      const { error } = await supabase.from("video_share_links").insert(row);
      if (error) throw new Error(error.message.includes("slug") ? "That link name is already taken." : error.message);
    }
    return { token, slug: row.slug as string | null };
  });

/** Owner: every visitor comment or decision left on their presentation page. */
export const listPresentationFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ video_project_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: link } = await context.supabase
      .from("video_share_links")
      .select("id")
      .eq("video_project_id", data.video_project_id)
      .maybeSingle();
    if (!link) return [];
    const { data: rows, error } = await context.supabase
      .from("video_presentation_feedback")
      .select("id, visitor_name, kind, note, created_at")
      .eq("share_link_id", (link as any).id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Public: read one presentation page by its slug or token. */
export const getRevealPresentation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ key: z.string().min(6).max(80), password: z.string().max(80).nullable().optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { loadPresentation } = await import("@/lib/reveal.server");
    return loadPresentation(data.key, data.password ?? null);
  });

/** Public: a visitor comment or approval on a presentation page. */
export const submitPresentationFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        key: z.string().min(6).max(80),
        kind: z.enum(["comment", "approved", "changes"]).default("comment"),
        name: z.string().max(80).nullable().optional(),
        email: z.string().max(160).nullable().optional(),
        note: z.string().max(1200).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("video_share_links")
      .select("id, user_id, comments_enabled, approval_enabled")
      .or(`slug.eq.${data.key},token.eq.${data.key}`)
      .maybeSingle();
    if (!link) throw new Error("That presentation is no longer available.");
    const l = link as any;
    if (data.kind === "comment" && !l.comments_enabled) throw new Error("Comments are turned off for this page.");
    if (data.kind !== "comment" && !l.approval_enabled) throw new Error("Approvals are turned off for this page.");
    const { error } = await supabaseAdmin.from("video_presentation_feedback").insert({
      user_id: l.user_id,
      share_link_id: l.id,
      visitor_name: data.name || null,
      visitor_email: data.email || null,
      kind: data.kind,
      note: data.note || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
