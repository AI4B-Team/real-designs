import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DetectInput = z.object({ image: z.string().min(16) });

/**
 * Clutter detection. Free by design: the user selects, deselects, brushes and
 * changes their mind for as long as they like without spending a credit.
 */
export const detectClutter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DetectInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { detectClutterItems } = await import("@/lib/declutter.server");
    const { normalizeDetections, normalizeRoomRead } = await import("@/lib/declutter-brief");
    const raw = await detectClutterItems(data.image, apiKey);
    return { detections: normalizeDetections(raw), room: normalizeRoomRead(raw) };
  });

const Box = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

const Region = z.object({ label: z.string().max(80), box: Box });

const PayloadShape = z.object({
  mode: z.enum(["auto", "select", "surfaces", "personal", "empty_room"]),
  room_type: z.string().max(60).default("room"),
  remove: z.array(Region).max(40).default([]),
  keep: z.array(Region).max(40).default([]),
  strokes: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        r: z.number().min(0).max(1),
        kind: z.enum(["remove", "keep"]),
      }),
    )
    .max(400)
    .default([]),
  categories: z.array(z.string().max(30)).max(20).default([]),
  notes: z.string().max(600).nullable().default(null),
  room_summary: z.string().max(300).nullable().default(null),
  surfaces: z.array(z.string().max(80)).max(10).default([]),
  mask_native: z.boolean().default(false),
});

const RenderInput = z.object({
  image: z.string().min(16),
  /** The rendered mask overlay; the removal regions are magenta. */
  overlay: z.string().min(16).nullable().default(null),
  /** The full-resolution binary mask: white is editable, black is protected. */
  mask: z.string().min(16).nullable().default(null),
  /** Typed word that unlocks the destructive Empty Room mode. */
  confirm: z.string().max(20).nullable().default(null),
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
 * Masked removal. One credit per result: each run is charged immediately
 * before its own request and refunded exactly once if that request fails, so a
 * partially successful batch bills only for the images it produced.
 */
export const renderDeclutter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RenderInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const { buildDeclutterPrompt, renderDecluttered, IMAGE_MODEL } = await import(
      "@/lib/declutter.server"
    );
    const { EMPTY_ROOM_CONFIRM, classificationFor, disclosureFor } = await import(
      "@/lib/declutter-brief"
    );
    const { runGenerationItem } = await import("@/lib/generation-run.server");
    const { imageIdentity } = await import("@/lib/generation-identity");

    /* The destructive mode is re-checked on the server: a client that skipped
       the confirmation dialog still cannot empty a room. */
    if (
      data.payload.mode === "empty_room" &&
      String(data.confirm || "").trim().toUpperCase() !== EMPTY_ROOM_CONFIRM
    )
      throw new Error("Empty Room needs its own confirmation before it can run.");

    if (
      data.payload.mode !== "empty_room" &&
      !data.payload.remove.length &&
      !data.payload.strokes.some((s) => s.kind === "remove")
    )
      throw new Error("Nothing was selected for removal.");

    const results: Array<{ id: string; label: string; image: string | null; error: string | null }> = [];
    let balance: number | null = null;
    let remainingToday: number | null = null;
    let charges = 0;

    for (const run of data.runs) {
      const outcome = await runGenerationItem(
        {
          userId: context.userId,
          action: "design",
          kind: "declutter.render",
          note: `Declutter, ${data.payload.room_type || "room"} (${run.label})`,
          requestId: `${data.request_id ?? ""}:${run.id}`,
          parts: [imageIdentity(data.image), imageIdentity(data.mask), run.id, run.label, run.directive, data.payload.room_type, data.payload.targets.length, data.payload.strokes.length],
        },
        async () => renderDecluttered(
          buildDeclutterPrompt(data.payload as any, run.directive ? run : null),
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
      throw new Error(results[0]?.error || "Declutter did not produce an image.");

    return {
      results,
      charged: charges,
      balance,
      remainingToday,
      classification: classificationFor(data.payload.mode),
      disclosure: disclosureFor(data.payload.mode),
      mode: data.payload.mode,
      model: IMAGE_MODEL,
    };
  });

const CheckInput = z.object({ before: z.string().min(16), after: z.string().min(16) });

/** Free post-generation inspection: never charges, never blocks the result. */
export const checkDeclutteredResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { inspectDecluttered } = await import("@/lib/declutter.server");
    const { normalizeQuality } = await import("@/lib/declutter-brief");
    return { report: normalizeQuality(await inspectDecluttered(data.before, data.after, apiKey)) };
  });
