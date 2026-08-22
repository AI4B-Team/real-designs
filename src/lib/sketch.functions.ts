import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ImageInput = z.object({ image: z.string().min(16) });

/**
 * Source classification. Free: it runs before anything can be charged, and its
 * whole job is to decide whether this upload may be rendered at all.
 */
export const classifySketch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImageInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { classifySketchSource } = await import("@/lib/sketch.server");
    const { normalizeClassification } = await import("@/lib/sketch-brief");
    return { classification: normalizeClassification(await classifySketchSource(data.image, apiKey)) };
  });

/** Geometry reading. Also free: the user must be able to correct it first. */
export const detectSketchPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImageInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { detectSketchGeometry } = await import("@/lib/sketch.server");
    const { normalizeGeometry } = await import("@/lib/sketch-brief");
    return { geometry: normalizeGeometry(await detectSketchGeometry(data.image, apiKey)) };
  });

const BoxShape = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

const CameraShape = z.object({
  id: z.string().max(40),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  direction: z.number().min(0).max(359),
  height: z.number().min(1).max(30),
  fov: z.number().min(20).max(120),
  label: z.string().max(40),
});

const ScaleShape = z.object({
  known: z.boolean(),
  reference: z.string().max(120).nullable(),
  length: z.number().nullable(),
  units: z.enum(["ft", "m", "unknown"]),
  source: z.enum(["user", "drawing"]).nullable(),
});

const PayloadShape = z.object({
  source_kind: z.string().max(40),
  source_label: z.string().max(60),
  mode: z.string().max(40),
  mode_label: z.string().max(60),
  mode_rule: z.string().max(600),
  room_type: z.string().max(60).nullable(),
  style_id: z.string().max(80).nullable(),
  style_name: z.string().max(80).nullable(),
  material_direction: z.string().max(40),
  material_label: z.string().max(60),
  material_rule: z.string().max(300),
  furniture_level: z.string().max(40),
  furniture_label: z.string().max(60),
  furniture_rule: z.string().max(300),
  finish_grade: z.string().max(40),
  finish_label: z.string().max(60),
  finish_rule: z.string().max(300),
  units: z.enum(["ft", "m", "unknown"]),
  scale: ScaleShape,
  dimensions: z
    .array(
      z.object({
        id: z.string().max(40),
        label: z.string().max(60),
        value: z.number(),
        units: z.enum(["ft", "m", "unknown"]),
        entered: z.boolean(),
      }),
    )
    .max(24),
  dimensions_known: z.boolean(),
  camera: CameraShape.nullable(),
  cameras: z.array(CameraShape).max(8),
  geometry: z
    .array(
      z.object({
        id: z.string().max(60),
        kind: z.string().max(30),
        label: z.string().max(70),
        box: BoxShape,
        dimension: z.string().max(40).nullable(),
        detail: z.string().max(180).nullable(),
        origin: z.enum(["detected", "user"]),
      }),
    )
    .max(160),
  geometry_summary: z.string().max(400).nullable(),
  uncertain: z.array(z.string().max(70)).max(40),
  notes: z.string().max(600).nullable(),
  scene_id: z.string().max(40),
  continuity: z
    .array(
      z.object({
        mode: z.string().max(40),
        label: z.string().max(60),
        camera: z.string().max(120).nullable(),
      }),
    )
    .max(8),
  disclaimer: z.string().max(200),
});

const RenderInput = z.object({
  image: z.string().min(16),
  reference: z.string().min(16).nullable().default(null),
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
});

/**
 * Renders one or more views of the interpreted scene. One credit per image:
 * each run is charged immediately before its own request and refunded exactly
 * once when that request fails, so a partial batch bills only what it produced.
 */
export const renderSketch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RenderInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const { buildSketchPrompt, renderSketchView, IMAGE_MODEL } = await import("@/lib/sketch.server");
    const { charge, refund, chargeErrorMessage } = await import("@/lib/credits.server");
    const { SKETCH_CLASSIFICATION, CONCEPT_DISCLAIMER } = await import("@/lib/sketch-brief");

    const results: Array<{ id: string; label: string; image: string | null; error: string | null }> = [];
    let balance: number | null = null;
    let remainingToday: number | null = null;
    let charges = 0;
    /* The first successful image becomes the continuity reference for the
       remaining runs, so every view of a scene shares its materials. */
    let reference: string | null = data.reference;

    for (const run of data.runs) {
      const charged = await charge(
        context.userId,
        "design",
        `Sketch To Render, ${data.payload.mode} (${run.label})`,
      );
      if (!charged.ok) {
        if (!results.length) throw new Error(chargeErrorMessage(charged));
        results.push({ id: run.id, label: run.label, image: null, error: chargeErrorMessage(charged) });
        break;
      }
      charges += charged.charged;
      balance = charged.balance;
      remainingToday = charged.remainingToday ?? null;
      try {
        const image = await renderSketchView(
          buildSketchPrompt(data.payload as any, run.directive ? run : null),
          data.image,
          reference,
          apiKey,
        );
        if (!reference) reference = image;
        results.push({ id: run.id, label: run.label, image, error: null });
      } catch (err) {
        await refund(context.userId, charged.charged, "Sketch To Render failed");
        charges -= charged.charged;
        results.push({
          id: run.id,
          label: run.label,
          image: null,
          error: (err as Error)?.message || "That render did not finish.",
        });
      }
    }

    if (!results.some((r) => r.image))
      throw new Error(results[0]?.error || "The render did not produce an image.");

    return {
      results,
      charged: charges,
      balance,
      remainingToday,
      classification: SKETCH_CLASSIFICATION,
      disclaimer: CONCEPT_DISCLAIMER,
      scene_id: data.payload.scene_id,
      model: IMAGE_MODEL,
    };
  });

const DriftInput = z.object({
  drawing: z.string().min(16),
  render: z.string().min(16),
  payload: PayloadShape,
});

/** Free post-generation comparison: never charges, never blocks the result. */
export const checkSketchDrift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DriftInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { inspectSketchDrift } = await import("@/lib/sketch.server");
    const { normalizeDrift } = await import("@/lib/sketch-brief");
    return {
      report: normalizeDrift(await inspectSketchDrift(data.drawing, data.render, data.payload as any, apiKey)),
    };
  });
