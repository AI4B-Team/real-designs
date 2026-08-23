import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DetectInput = z.object({ image: z.string().min(16) });

/**
 * Surface detection. Free by design: the user selects a surface, browses the
 * catalog and changes their mind for as long as they like without spending a
 * credit.
 */
export const detectSurfaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DetectInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { detectSurfaceList } = await import("@/lib/materials.server");
    const { normalizeSurfaces, normalizeRoomRead } = await import("@/lib/materials-brief");
    const raw = await detectSurfaceList(data.image, apiKey);
    return { surfaces: normalizeSurfaces(raw), room: normalizeRoomRead(raw) };
  });

const Box = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

const Region = z.object({ label: z.string().max(80), box: Box });

const PayloadShape = z.object({
  surface_kind: z.string().max(40),
  surface_label: z.string().max(80).default("surface"),
  surface_prompt_name: z.string().max(120).default("the selected surface"),
  current_material: z.string().max(120).default("the existing material"),
  target: z.array(Region).max(4).default([]),
  keep: z.array(Region).max(20).default([]),
  strokes: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        r: z.number().min(0).max(1),
        kind: z.enum(["include", "exclude"]),
      }),
    )
    .max(400)
    .default([]),
  material_id: z.string().max(60),
  material_name: z.string().max(80),
  material_spec: z.string().max(600),
  finish: z.string().max(200).default(""),
  color: z.string().max(200).default(""),
  pattern: z.string().max(200).nullable().default(null),
  scale: z.string().max(200).nullable().default(null),
  grout: z.string().max(200).nullable().default(null),
  room_type: z.string().max(60).default("room"),
  room_summary: z.string().max(300).nullable().default(null),
  lighting: z.string().max(300).nullable().default(null),
  other_surfaces: z.array(z.string().max(120)).max(12).default([]),
  notes: z.string().max(600).nullable().default(null),
  mask_native: z.boolean().default(false),
});

const RenderInput = z.object({
  image: z.string().min(16),
  /** The rendered mask overlay; the target surface is magenta. */
  overlay: z.string().min(16).nullable().default(null),
  /** The full-resolution binary mask: white is editable, black is protected. */
  mask: z.string().min(16).nullable().default(null),
  payload: PayloadShape,
  runs: z
    .array(
      z.object({
        id: z.string().max(30),
        label: z.string().max(60),
        directive: z.string().max(400).default(""),
      }),
    )
    .min(1)
    .max(4),
  /* Stable identity of one user click; reused by retries of that click. */
  request_id: z.string().max(80).nullable().optional(),
});

/**
 * Masked single-surface swap. One credit per option: each run is charged
 * immediately before its own request and refunded exactly once if that request
 * fails, so a partially successful batch bills only for the images it made.
 */
export const renderMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RenderInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const { buildMaterialsPrompt, renderMaterialSwap, IMAGE_MODEL } = await import(
      "@/lib/materials.server"
    );
    const { MATERIALS_CLASSIFICATION, MATERIALS_DISCLOSURE } = await import("@/lib/materials-brief");
    const { isCompatible } = await import("@/lib/materials-catalog");
    const { runGenerationItem } = await import("@/lib/generation-run.server");
    const { imageIdentity } = await import("@/lib/generation-identity");

    /* The single-surface promise is re-checked on the server: a client that
       skipped the panel still cannot ask for a whole-room refinish. */
    if (!data.payload.target.length && !data.payload.strokes.some((s) => s.kind === "include"))
      throw new Error("No surface was selected, so there is nothing to change.");
    if (!isCompatible(data.payload.surface_kind, data.payload.material_id))
      throw new Error("That material cannot be applied to that surface.");

    const results: Array<{ id: string; label: string; image: string | null; error: string | null }> = [];
    let balance: number | null = null;
    let remainingToday: number | null = null;
    let charges = 0;

    for (const run of data.runs) {
      const outcome = await runGenerationItem(
        {
          userId: context.userId,
          action: "design",
          kind: "materials.render",
          note: `Materials, ${data.payload.surface_label} to ${data.payload.material_name} (${run.label})`,
          requestId: `${data.request_id ?? ""}:${run.id}`,
          parts: [imageIdentity(data.image), imageIdentity(data.mask), run.id, run.label, run.directive, data.payload.surface_label, data.payload.material_name],
        },
        async () => renderMaterialSwap(
          buildMaterialsPrompt(data.payload as any, run.directive ? run : null),
          data.image,
          data.overlay,
          data.mask,
          apiKey,
        ),
      );

      if (!outcome.ok) {
        /* A refused charge stops the batch; a failed render fails only its own
           item, and its credit was already refunded exactly once. */
        if (outcome.blocked && !results.length) throw new Error(outcome.error);
        results.push({ id: run.id, label: run.label, image: null, error: outcome.error });
        if (outcome.blocked) break;
        continue;
      }

      charges += outcome.charged;
      balance = outcome.balance;
      remainingToday = outcome.remainingToday;
      results.push({ id: run.id, label: run.label, image: outcome.value, error: null });
    }

    if (!results.some((r) => r.image))
      throw new Error(results[0]?.error || "The material swap did not produce an image.");

    return {
      results,
      charged: charges,
      balance,
      remainingToday,
      classification: MATERIALS_CLASSIFICATION,
      disclosure: MATERIALS_DISCLOSURE,
      model: IMAGE_MODEL,
    };
  });

const CheckInput = z.object({ before: z.string().min(16), after: z.string().min(16) });

/** Free post-generation inspection: never charges, never blocks the result. */
export const checkMaterialResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { inspectMaterialSwap } = await import("@/lib/materials.server");
    const { normalizeQuality } = await import("@/lib/materials-brief");
    return { report: normalizeQuality(await inspectMaterialSwap(data.before, data.after, apiKey)) };
  });
