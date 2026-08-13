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
    const { charge, chargeErrorMessage } = await import("@/lib/credits.server");
    const charged = await charge(userId, "video", "REAL REVEAL render");
    if (!charged.ok) throw new Error(chargeErrorMessage(charged));

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
    return { variants: out ?? [], balance: charged.balance };
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

/* ============================ SHARING ============================= */

export const saveShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        video_project_id: z.string().uuid(),
        privacy_type: z.enum(["public", "private"]).default("public"),
        expires_at: z.string().max(40).nullable().optional(),
        allow_download: z.boolean().default(true),
        show_project_details: z.boolean().default(true),
        show_products: z.boolean().default(false),
        show_budget: z.boolean().default(false),
        comments_enabled: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("video_share_links")
      .select("id, token")
      .eq("video_project_id", data.video_project_id)
      .maybeSingle();
    const token = existing?.token ?? crypto.randomUUID().replace(/-/g, "");
    const row: any = { ...data, user_id: userId, token };
    if (existing) {
      const { error } = await supabase.from("video_share_links").update(row).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("video_share_links").insert(row);
      if (error) throw new Error(error.message);
    }
    return { token };
  });
