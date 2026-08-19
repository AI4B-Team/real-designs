import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Source detection service boundary.
 *
 * Classifies an uploaded Studio source (photo, sketch, drawing or floor plan)
 * so the user never has to declare the file type before uploading. The result
 * is advisory: the UI always lets the user override it.
 *
 * Never guesses from the filename. If the model is unavailable or unsure the
 * answer is "uncertain" and the UI asks the user.
 */

export const SOURCE_TYPES = [
  "interior_photo",
  "exterior_photo",
  "landscape_photo",
  "sketch",
  "floor_plan",
  "uncertain",
  "unsupported",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export type SourceDetection = {
  sourceType: SourceType;
  confidence: number;
  suggestedWorkflow: string;
};

export const WORKFLOW_BY_TYPE: Record<SourceType, string> = {
  interior_photo: "interior_design",
  exterior_photo: "exterior_design",
  landscape_photo: "landscape_design",
  sketch: "sketch_to_design",
  floor_plan: "floor_plan_visualization",
  uncertain: "manual_classification",
  unsupported: "manual_classification",
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  interior_photo: "Interior Photo",
  exterior_photo: "Exterior Photo",
  landscape_photo: "Landscape Photo",
  sketch: "Sketch Or Concept Drawing",
  floor_plan: "Floor Plan",
  uncertain: "Not Sure Yet",
  unsupported: "Unsupported File",
};

const Input = z.object({
  /** Data URL of the uploaded file (image or PDF). */
  file: z.string().min(32).max(12_000_000),
  mimeType: z.string().max(120).default("image/jpeg"),
});

const MODEL = "google/gemini-2.5-flash";

const INSTRUCTION = [
  "Classify this uploaded file for an architectural design tool.",
  'Answer with strict JSON only: {"sourceType":"...","confidence":0.0}',
  "sourceType must be exactly one of: interior_photo, exterior_photo, landscape_photo, sketch, floor_plan, uncertain, unsupported.",
  "interior_photo: a photograph taken inside a building.",
  "exterior_photo: a photograph of a building from outside.",
  "landscape_photo: a photograph of a yard, garden or outdoor grounds with no dominant building.",
  "sketch: a hand drawing, rendering sketch or concept drawing of a space.",
  "floor_plan: a top-down architectural plan with rooms, walls or dimensions.",
  "unsupported: not related to a property, space or plan.",
  "uncertain: you cannot tell with reasonable confidence.",
  "confidence is 0 to 1. Use the image content and document structure, never the filename.",
].join("\n");

function normalise(raw: unknown): SourceDetection {
  const obj = (raw ?? {}) as { sourceType?: string; confidence?: number };
  const type = (SOURCE_TYPES as readonly string[]).includes(obj.sourceType || "")
    ? (obj.sourceType as SourceType)
    : "uncertain";
  let confidence = typeof obj.confidence === "number" ? obj.confidence : 0;
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));
  const settled: SourceType = confidence < 0.55 && type !== "unsupported" ? "uncertain" : type;
  return {
    sourceType: settled,
    confidence: settled === "uncertain" ? confidence : confidence,
    suggestedWorkflow: WORKFLOW_BY_TYPE[settled],
  };
}

const UNSURE: SourceDetection = {
  sourceType: "uncertain",
  confidence: 0,
  suggestedWorkflow: WORKFLOW_BY_TYPE.uncertain,
};

export const detectSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<SourceDetection> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return UNSURE;

    const isPdf = /pdf/i.test(data.mimeType);
    const content: any[] = [{ type: "text", text: INSTRUCTION }];
    if (isPdf) {
      content.push({ type: "file", file: { filename: "upload.pdf", file_data: data.file } });
    } else if (/^image\//.test(data.mimeType)) {
      content.push({ type: "image_url", image_url: { url: data.file } });
    } else {
      return {
        sourceType: "unsupported",
        confidence: 1,
        suggestedWorkflow: WORKFLOW_BY_TYPE.unsupported,
      };
    }

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content }],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) return UNSURE;
      const payload = (await res.json()) as any;
      const text: string = payload?.choices?.[0]?.message?.content ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return UNSURE;
      return normalise(JSON.parse(match[0]));
    } catch {
      return UNSURE;
    }
  });
