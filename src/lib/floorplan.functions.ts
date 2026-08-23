import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ImageInput = z.object({ image: z.string().min(16) });

/**
 * Source classification. Free: it runs before anything can be charged, and its
 * whole job is to decide whether this upload is a floor plan at all.
 */
export const classifyFloorplan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImageInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { classifyFloorplanSource } = await import("@/lib/floorplan.server");
    const { normalizeClassification } = await import("@/lib/floorplan-brief");
    return {
      classification: normalizeClassification(await classifyFloorplanSource(data.image, apiKey)),
    };
  });

/** Geometry reading. Also free: the user must be able to correct it first. */
export const detectFloorplan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImageInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { detectFloorplanGeometry } = await import("@/lib/floorplan.server");
    const { normalizeGeometry } = await import("@/lib/floorplan-brief");
    return { geometry: normalizeGeometry(await detectFloorplanGeometry(data.image, apiKey)) };
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
  floor: z.string().max(40),
});

const ScaleShape = z.object({
  known: z.boolean(),
  reference: z.string().max(120).nullable(),
  length: z.number().nullable(),
  units: z.enum(["ft", "m", "unknown"]),
  source: z.enum(["user", "drawing"]).nullable(),
  pixels: z.number().nullable(),
});

const PayloadShape = z.object({
  source_kind: z.string().max(40),
  source_label: z.string().max(60),
  output: z.string().max(40),
  output_label: z.string().max(60),
  output_rule: z.string().max(600),
  floor_id: z.string().max(40),
  floor_label: z.string().max(60),
  floors_total: z.number().min(1).max(6),
  style_id: z.string().max(80).nullable(),
  style_name: z.string().max(80).nullable(),
  furniture_level: z.string().max(40),
  furniture_label: z.string().max(60),
  furniture_rule: z.string().max(300),
  finish_grade: z.string().max(40),
  finish_label: z.string().max(60),
  finish_rule: z.string().max(300),
  units: z.enum(["ft", "m", "unknown"]),
  scale: ScaleShape,
  scale_statement: z.string().max(300),
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
  dimension_statement: z.string().max(300),
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
  rooms: z.array(z.string().max(70)).max(40),
  camera: CameraShape.nullable(),
  uncertain: z.array(z.string().max(70)).max(40),
  confidence: z.number().min(0).max(100),
  notes: z.string().max(600).nullable(),
  plan_id: z.string().max(60),
  disclaimer: z.string().max(200),
});

const RenderInput = z.object({
  image: z.string().min(16),
  reference: z.string().min(16).nullable().default(null),
  payload: PayloadShape,
  runs: z
    .array(
      z.object({
        id: z.string().max(60),
        label: z.string().max(70),
        directive: z.string().max(400).default(""),
        roomId: z.string().max(60).nullable().default(null),
      }),
    )
    .min(1)
    .max(8),
  /* Stable identity of one user click; reused by retries of that click. */
  request_id: z.string().max(80).nullable().optional(),
});

/**
 * Renders one or more views of the interpreted plan. Six credits per view:
 * each run is charged immediately before its own request and refunded exactly
 * once when that request fails, so a partial batch bills only what it produced.
 */
export const renderFloorplan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RenderInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const { buildFloorplanPrompt, renderFloorplanView, IMAGE_MODEL } = await import(
      "@/lib/floorplan.server"
    );
    const { charge, refund, chargeErrorMessage } = await import("@/lib/credits.server");
    const { FLOORPLAN_CLASSIFICATION, CONCEPT_DISCLAIMER } = await import("@/lib/floorplan-brief");

    const results: Array<{
      id: string;
      label: string;
      roomId: string | null;
      image: string | null;
      error: string | null;
    }> = [];
    let balance: number | null = null;
    let remainingToday: number | null = null;
    let charges = 0;
    /* The first successful image becomes the continuity reference for the
       remaining runs, so every view of a plan shares its finishes. */
    let reference: string | null = data.reference;

    for (const run of data.runs) {
      const charged = await charge(
        context.userId,
        "plan_3d",
        `Floorplan, ${data.payload.output_label} (${run.label})`,
      );
      if (!charged.ok) {
        if (!results.length) throw new Error(chargeErrorMessage(charged));
        results.push({
          id: run.id,
          label: run.label,
          roomId: run.roomId,
          image: null,
          error: chargeErrorMessage(charged),
        });
        break;
      }
      charges += charged.charged;
      balance = charged.balance;
      remainingToday = charged.remainingToday ?? null;
      try {
        const image = await renderFloorplanView(
          buildFloorplanPrompt(data.payload as any, run.directive ? (run as any) : null),
          data.image,
          reference,
          apiKey,
        );
        if (!reference) reference = image;
        results.push({ id: run.id, label: run.label, roomId: run.roomId, image, error: null });
      } catch (err) {
        await refund(context.userId, charged.charged, "Floorplan render failed");
        charges -= charged.charged;
        results.push({
          id: run.id,
          label: run.label,
          roomId: run.roomId,
          image: null,
          error: (err as Error)?.message || "That view did not finish.",
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
      classification: FLOORPLAN_CLASSIFICATION,
      disclaimer: CONCEPT_DISCLAIMER,
      plan_id: data.payload.plan_id,
      model: IMAGE_MODEL,
    };
  });

const DriftInput = z.object({
  plan: z.string().min(16),
  render: z.string().min(16),
  payload: PayloadShape,
});

/** Free post-generation comparison: never charges, never blocks the result. */
export const checkFloorplanDrift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DriftInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { inspectFloorplanDrift } = await import("@/lib/floorplan.server");
    const { normalizeDrift } = await import("@/lib/floorplan-brief");
    return {
      report: normalizeDrift(
        await inspectFloorplanDrift(data.plan, data.render, data.payload as any, apiKey),
      ),
    };
  });
