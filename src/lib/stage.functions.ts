import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AnalyzeInput = z.object({ image: z.string().min(16) });

/**
 * Room understanding for Virtual Stage. Free: it runs before any charge and
 * its whole job is to decide whether staging may be charged for at all.
 */
export const analyzeStageRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { analyzeRoom } = await import("@/lib/stage.server");
    const { normalizeAnalysis } = await import("@/lib/stage-brief");
    return { analysis: normalizeAnalysis(await analyzeRoom(data.image, apiKey)) };
  });

const AnalysisShape = z.object({
  roomType: z.string().nullable().default(null),
  occupancy: z.enum(["empty", "partial", "furnished", "unknown"]).default("unknown"),
  confidence: z.number().min(0).max(1).default(0),
  features: z.array(z.string().max(30)).max(20).default([]),
  furniture: z.array(z.string().max(60)).max(20).default([]),
  zones: z.array(z.string().max(160)).max(8).default([]),
  summary: z.string().max(300).nullable().default(null),
});

const PayloadShape = z.object({
  mode: z.enum(["empty", "restage", "add_items", "replace", "remove_restage"]),
  room_type: z.string().max(60),
  project_type: z.string().max(20).default("interior"),
  style_id: z.string().max(80).nullable().default(null),
  direction: z.string().max(80).default(""),
  grade: z.string().max(40).default("Retail Grade"),
  occupancy: z.enum(["minimal", "balanced", "full"]).default("balanced"),
  purpose: z.enum(["mls", "str", "model_home", "owner", "luxury"]).default("mls"),
  palette: z.string().max(30).default("auto"),
  categories: z.array(z.string().max(40)).max(24).default([]),
  keep: z.array(z.string().max(60)).max(20).default([]),
  remove: z.array(z.string().max(60)).max(20).default([]),
  avoid: z.array(z.string().max(60)).max(20).default([]),
  room_choices: z.record(z.string().max(30), z.string().max(40)).default({}),
  free_zones: z.array(z.string().max(10)).max(24).default([]),
  preferred_zones: z.array(z.string().max(10)).max(24).default([]),
  notes: z.string().max(600).nullable().default(null),
  property_direction: z.string().max(300).nullable().default(null),
  consistency_with: z.array(z.string().max(60)).max(10).default([]),
  analysis: AnalysisShape,
});

const RenderInput = z.object({
  image: z.string().min(16),
  payload: PayloadShape,
  runs: z
    .array(
      z.object({
        id: z.enum(["primary", "layout", "furniture", "lighter", "fuller"]),
        label: z.string().max(60),
        directive: z.string().max(400).default(""),
      }),
    )
    .min(1)
    .max(5),
  /* Stable identity of one user click; reused by retries of that click. */
  request_id: z.string().max(80).nullable().optional(),
});

/**
 * Staged render. One credit per result: each run is charged immediately before
 * its own request and refunded exactly once if that request fails, so a
 * partially successful batch bills only for the images it produced.
 */
export const renderStaging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RenderInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const { buildStagePrompt, renderStagedImage } = await import("@/lib/stage.server");
    const { charge, refund, chargeErrorMessage } = await import("@/lib/credits.server");

    const results: Array<{
      id: string;
      label: string;
      image: string | null;
      error: string | null;
    }> = [];
    let balance: number | null = null;
    let remainingToday: number | null = null;
    let charges = 0;

    for (const run of data.runs) {
      const charged = await charge(
        context.userId,
        "design",
        `Virtual Stage, ${data.payload.room_type || "room"} (${run.label})`,
      );
      if (!charged.ok) {
        /* Out of credits partway through: stop, keep what already succeeded. */
        if (!results.length) throw new Error(chargeErrorMessage(charged));
        results.push({ id: run.id, label: run.label, image: null, error: chargeErrorMessage(charged) });
        break;
      }
      charges += charged.charged;
      balance = charged.balance;
      remainingToday = charged.remainingToday ?? null;
      try {
        const image = await renderStagedImage(
          buildStagePrompt(data.payload as any, run.directive ? run : null),
          data.image,
          apiKey,
        );
        results.push({ id: run.id, label: run.label, image, error: null });
      } catch (err) {
        await refund(context.userId, charged.charged, "Virtual Stage failed");
        charges -= charged.charged;
        results.push({
          id: run.id,
          label: run.label,
          image: null,
          error: (err as Error)?.message || "That staging run did not finish.",
        });
      }
    }

    if (!results.some((r) => r.image))
      throw new Error(results[0]?.error || "Staging did not produce an image.");

    return {
      results,
      charged: charges,
      balance,
      remainingToday,
      classification: "Virtually Staged" as const,
      mode: data.payload.mode,
    };
  });

const CheckInput = z.object({ before: z.string().min(16), after: z.string().min(16) });

/** Free post-generation inspection: never charges, never blocks the result. */
export const checkStagedResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");
    const { inspectStagedResult } = await import("@/lib/stage.server");
    const { normalizeQuality } = await import("@/lib/stage-brief");
    return { report: normalizeQuality(await inspectStagedResult(data.before, data.after, apiKey)) };
  });
