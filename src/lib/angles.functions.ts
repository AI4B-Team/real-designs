import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ImageInput = z.object({ image: z.string().min(16) });

/**
 * Read the room once. Free: it runs before anything can be charged and its
 * whole job is to give every angle in the set the same description to obey.
 */
export const readAngleRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImageInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { readRoomContinuity } = await import("@/lib/angles.server");
    const { normalizeContinuity } = await import("@/lib/angles-brief");
    return { continuity: normalizeContinuity(await readRoomContinuity(data.image, apiKey)) };
  });

const CustomCameraShape = z.object({
  direction: z.enum(["left", "right", "up", "down"]),
  rotation: z.number().min(0).max(180),
  dolly: z.number().min(-12).max(12),
  height: z.number().min(1).max(12),
  fov: z.number().min(20).max(120),
});

const ContinuityShape = z.object({
  summary: z.string().max(300).nullable(),
  architecture: z.string().max(240).nullable(),
  windows: z.string().max(240).nullable(),
  furniture: z.string().max(300).nullable(),
  materials: z.string().max(300).nullable(),
  palette: z.string().max(240).nullable(),
  lighting: z.string().max(240).nullable(),
  decor: z.string().max(240).nullable(),
  style: z.string().max(90).nullable(),
  unseen: z.array(z.string().max(90)).max(8),
});

const PayloadShape = z.object({
  set_id: z.string().max(60),
  source_kind: z.enum(["generated", "staged", "sketch_render", "saved_version", "photograph"]),
  source_label: z.string().max(60),
  source_fidelity: z.enum(["structured", "generated", "photograph"]),
  room_type: z.string().max(60).nullable(),
  style_id: z.string().max(80).nullable(),
  style_name: z.string().max(80).nullable(),
  output_set: z.enum(["single", "three", "four_corner", "listing", "video"]),
  output_set_label: z.string().max(60),
  sequence: z.boolean(),
  continuity: ContinuityShape,
  signals: z.array(z.string().max(40)).max(10),
  prior_prompt: z.string().max(1200).nullable(),
  design_dna: z.string().max(600).nullable(),
  notes: z.string().max(600).nullable(),
  disclosure: z.string().max(200).nullable(),
  total_angles: z.number().min(1).max(8),
});

const RunShape = z.object({
  id: z.string().max(40),
  preset: z.enum([
    "slight_left",
    "slight_right",
    "wider",
    "closer",
    "opposite_corner",
    "doorway",
    "eye_level_center",
    "custom",
  ]),
  label: z.string().max(60),
  directive: z.string().min(4).max(600),
  camera: CustomCameraShape.nullable(),
  showsUnseen: z.boolean(),
});

const RenderInput = z.object({
  image: z.string().min(16),
  /** An already approved view of this set, reused as the continuity anchor. */
  reference: z.string().min(16).nullable().default(null),
  payload: PayloadShape,
  runs: z.array(RunShape).min(1).max(8),
  /* Stable identity of one user click; reused by retries of that click. */
  request_id: z.string().max(80).nullable().optional(),
});

/**
 * Renders every selected camera position as one coordinated set. One credit
 * per angle: each run is charged immediately before its own request and
 * refunded exactly once when that request fails, so a partial set bills only
 * the images it actually produced. Every result carries the same angle-set id.
 */
export const renderAngleSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RenderInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const { buildAnglePrompt, renderAngleView, IMAGE_MODEL } = await import("@/lib/angles.server");
    const { runGenerationItem } = await import("@/lib/generation-run.server");
    const { imageIdentity } = await import("@/lib/generation-identity");

    const results: Array<{
      id: string;
      label: string;
      image: string | null;
      error: string | null;
    }> = [];
    let balance: number | null = null;
    let remainingToday: number | null = null;
    let charges = 0;
    /* The first good image anchors the rest of the set, so view four still
       matches view one instead of only matching the source photo. */
    let reference: string | null = data.reference;

    for (const run of data.runs) {
      const outcome = await runGenerationItem(
        {
          userId: context.userId,
          action: "design",
          kind: "angles.render",
          note: `Angles, ${data.payload.output_set} (${run.label})`,
          requestId: `${data.request_id ?? ""}:${run.id}`,
          parts: [imageIdentity(data.image), run.id, run.label, data.payload.output_set],
        },
        async () => renderAngleView(
          buildAnglePrompt(data.payload as any, run as any, !!reference),
          data.image,
          reference,
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
      if (!reference) reference = outcome.value;
      results.push({ id: run.id, label: run.label, image: outcome.value, error: null });
    }

    if (!results.some((r) => r.image))
      throw new Error(results[0]?.error || "The render did not produce an image.");

    return {
      results,
      charged: charges,
      balance,
      remainingToday,
      angle_set_id: data.payload.set_id,
      disclosure: data.payload.disclosure,
      model: IMAGE_MODEL,
    };
  });

const ScoreInput = z.object({
  source: z.string().min(16),
  render: z.string().min(16),
  payload: PayloadShape,
  run: RunShape,
});

/** Free cross-view scoring. Never charges, never blocks a delivered image. */
export const scoreAngleView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScoreInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { inspectAngleConsistency } = await import("@/lib/angles.server");
    const { normalizeConsistency } = await import("@/lib/angles-brief");
    const raw = await inspectAngleConsistency(
      data.source,
      data.render,
      data.payload as any,
      data.run as any,
      apiKey,
    );
    return { score: normalizeConsistency(raw, { id: data.run.id, label: data.run.label }) };
  });
