import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DetectInput = z.object({ image: z.string().min(16) });

/**
 * Object detection. Free by design: the user can select, deselect, brush,
 * refine and change their mind for as long as they like without a credit.
 */
export const detectObjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DetectInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { detectEditableObjects } = await import("@/lib/object-edit.server");
    const { normalizeDetections, roomReadOf } = await import("@/lib/object-edit-brief");
    const raw = await detectEditableObjects(data.image, apiKey);
    return { detections: normalizeDetections(raw), room: roomReadOf(raw) };
  });

const Box = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

const Region = z.object({ label: z.string().max(80), box: Box });

const PayloadShape = z.object({
  action: z.enum(["remove", "replace", "color", "material", "restyle", "duplicate", "move", "custom"]),
  action_label: z.string().max(40),
  target_label: z.string().max(160),
  targets: z.array(Region).max(20).default([]),
  protect: z.array(Region).max(40).default([]),
  strokes: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        r: z.number().min(0).max(1),
        kind: z.enum(["add", "erase", "protect"]),
      }),
    )
    .max(400)
    .default([]),
  grow: z.number().min(-0.2).max(0.2).default(0),
  feather: z.number().min(0).max(0.1).default(0),
  inverted: z.boolean().default(false),
  room_type: z.string().max(60).default("room"),
  surfaces: z.array(z.string().max(90)).max(10).default([]),
  instruction: z.string().max(600).nullable().default(null),
  color: z.string().max(60).nullable().default(null),
  material_id: z.string().max(60).nullable().default(null),
  material_label: z.string().max(80).nullable().default(null),
  material_prompt: z.string().max(400).nullable().default(null),
  surface_kind: z.string().max(60).nullable().default(null),
  notes: z.string().max(600).nullable().default(null),
  mask_attached: z.boolean().default(true),
});

const RenderInput = z.object({
  image: z.string().min(16),
  /** The rendered mask overlay: magenta is editable, green is protected. */
  overlay: z.string().min(16).nullable().default(null),
  /** The full-resolution binary mask: white is editable, black is protected. */
  mask: z.string().min(16).nullable().default(null),
  payload: PayloadShape,
  /* Stable identity of one user click; reused by retries of that click. */
  request_id: z.string().max(80).nullable().optional(),
});

/**
 * One masked edit, one credit. The credit is charged immediately before the
 * request and refunded exactly once if the request fails, so a failed edit
 * never costs anything.
 */
export const renderObjectEditResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RenderInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const { buildObjectEditPrompt, renderObjectEdit, IMAGE_MODEL } = await import(
      "@/lib/object-edit.server"
    );
    const { objectAction } = await import("@/lib/object-edit-brief");
    const { runGeneration } = await import("@/lib/generation-run.server");
    const { imageIdentity } = await import("@/lib/generation-identity");

    /* A selection that never reached the server is not a selection: the guard
       is re-checked here so a client bug can never spend a credit on an edit
       with no target. */
    const brushed = data.payload.strokes.some((s) => s.kind === "add");
    if (!data.payload.targets.length && !brushed)
      throw new Error("Select or brush the object you want to edit first.");

    const def = objectAction(data.payload.action);
    if (def.needs === "material" && !data.payload.material_id)
      throw new Error("Choose a material before running this edit.");
    if (def.needs === "color" && !data.payload.color)
      throw new Error("Choose a color before running this edit.");
    if ((def.needs === "instruction" || def.needs === "replacement" || def.needs === "style") && !data.payload.instruction)
      throw new Error("Describe the change before running this edit.");

    return runGeneration(
      {
        userId: context.userId,
        action: "design",
        kind: "object.edit",
        note: `Object Edit, ${data.payload.action_label} (${data.payload.target_label})`,
        requestId: data.request_id ?? null,
        parts: [
          imageIdentity(data.image),
          imageIdentity(data.mask),
          data.payload.action,
          data.payload.action_label,
          data.payload.target_label,
          data.payload.material_id,
          data.payload.color,
          data.payload.instruction,
          data.payload.targets.length,
          data.payload.strokes.length,
        ],
      },
      async (job) => {
        let image: string;
        try {
          image = await renderObjectEdit(
            buildObjectEditPrompt(data.payload as any),
            data.image,
            data.overlay,
            data.mask,
            apiKey,
          );
        } catch (err) {
          throw new Error((err as Error)?.message || "That edit did not finish.");
        }
        return {
          image,
          charged: job.charged,
          balance: job.balance,
          remainingToday: job.remainingToday,
          classification: def.classification,
          model: IMAGE_MODEL,
        };
      },
    );
  });

const CheckInput = z.object({ before: z.string().min(16), after: z.string().min(16) });

/** Free preservation inspection: never charges, never blocks the result. */
export const checkObjectEditResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { inspectObjectEdit } = await import("@/lib/object-edit.server");
    const { normalizePreservation } = await import("@/lib/object-edit-brief");
    return { report: normalizePreservation(await inspectObjectEdit(data.before, data.after, apiKey)) };
  });
