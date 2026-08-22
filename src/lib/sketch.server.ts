/**
 * Server helpers for Sketch To Render.
 *
 * Three free reads (classify the upload, detect its geometry, compare the
 * finished render against that geometry) and one charged write (render a
 * view). Every prompt that decides the picture is built in @/lib/sketch-brief,
 * so the panel, the server and the tests all agree.
 */

import {
  DRIFT_CHECKS,
  GEOMETRY_KINDS,
  SKETCH_KINDS,
  sketchPrompt,
  type SketchPayload,
  type SketchRun,
} from "@/lib/sketch-brief";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-3.7-flash";
export const IMAGE_MODEL = "google/gemini-2.5-flash-image";

function gatewayError(status: number): Error {
  if (status === 429) return new Error("Rate limit reached, try again in a moment.");
  if (status === 402) return new Error("AI credits exhausted for this workspace.");
  if (status === 403) return new Error("AI access is blocked for this workspace.");
  return new Error(`The AI request failed (${status}).`);
}

function parseJson(text: string): Record<string, unknown> {
  const raw = String(text || "").replace(/```(?:json)?/gi, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch (_) {
    return {};
  }
}

async function askAboutImages(
  prompt: string,
  images: string[],
  apiKey: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.map((url) => ({ type: "image_url", image_url: { url } })),
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw gatewayError(res.status);
  const payload = (await res.json()) as any;
  const text = payload?.choices?.[0]?.message?.content;
  const flat = Array.isArray(text)
    ? text.map((p: any) => (typeof p === "string" ? p : p?.text || "")).join("")
    : String(text || "");
  return parseJson(flat);
}

/* ------------------------------------------------------------- classify */

export const CLASSIFY_PROMPT =
  "You are looking at one uploaded image to decide what kind of architectural drawing it is, if any. " +
  "Answer only with JSON.\n" +
  'Return: {"kind": string, "confidence": 0..1, "summary": string, "reason": string, "alternatives": string[]}.\n' +
  "kind must be exactly one of: " +
  SKETCH_KINDS.map((k) => k.id).join(", ") +
  ".\n" +
  SKETCH_KINDS.map((k) => "- " + k.id + ": " + k.blurb).join("\n") +
  "\nUse photograph when the image is a photo of a real space or building rather than a drawing. " +
  "Use unsupported when nothing in the image reads as a drawing of a space at all.\n" +
  "summary: one sentence describing what the drawing shows.\n" +
  "reason: one sentence, only when the image is not a usable drawing, explaining why.\n" +
  "alternatives: other plausible kinds when you are unsure. Never guess with high confidence.";

export async function classifySketchSource(image: string, apiKey: string) {
  return askAboutImages(CLASSIFY_PROMPT, [image], apiKey);
}

/* --------------------------------------------------------------- detect */

export const GEOMETRY_PROMPT =
  "You are reading one architectural drawing and extracting its geometry so a renderer can follow it exactly. " +
  "Answer only with JSON.\n" +
  'Return: {"summary": string, "units": "ft" | "m" | "unknown", "scale": {"note": string | null}, ' +
  '"warnings": string[], "elements": [{"id": string, "kind": string, "label": string, ' +
  '"box": {"x": number, "y": number, "w": number, "h": number}, "dimension": string | null, ' +
  '"detail": string | null, "confidence": 0..1}]}.\n' +
  "kind must be one of: " +
  GEOMETRY_KINDS.map((k) => k.id).join(", ") +
  ".\n" +
  GEOMETRY_KINDS.map((k) => "- " + k.id + ": " + k.blurb).join("\n") +
  "\nbox is that element's bounding box normalized 0..1 with the origin at the top-left of the image.\n" +
  "label is what a person would call it, for example \"north exterior wall\" or \"kitchen\".\n" +
  "dimension: the measurement written on the drawing for that element, copied exactly, or null. " +
  "Never estimate a dimension and never invent one — if nothing is written, return null.\n" +
  "scale.note: the scale stated on the drawing, copied exactly, or null. Do not infer a scale.\n" +
  "confidence: how sure you are that this element is really there and correctly classified.\n" +
  "warnings: short sentences about anything ambiguous, unreadable or contradictory in the drawing.\n" +
  "List every wall, opening, door, window, room boundary, major fixture, furniture symbol, dimension, label and " +
  "camera or view marker you can actually see. Never invent an element that is not drawn.";

export async function detectSketchGeometry(image: string, apiKey: string) {
  return askAboutImages(GEOMETRY_PROMPT, [image], apiKey);
}

/* --------------------------------------------------------------- render */

export function buildSketchPrompt(payload: SketchPayload, run: SketchRun | null): string {
  return sketchPrompt(payload, run);
}

/**
 * Renders one view. The drawing is attached first and any reference image from
 * an earlier view of the same scene second, so materials carry across views.
 */
export async function renderSketchView(
  prompt: string,
  drawing: string,
  reference: string | null,
  apiKey: string,
): Promise<string> {
  const content: unknown[] = [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: drawing } },
  ];
  if (reference) content.push({ type: "image_url", image_url: { url: reference } });
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      modalities: ["image", "text"],
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw gatewayError(res.status);
  const payload = (await res.json()) as any;
  const msg = payload?.choices?.[0]?.message;
  const url: string | undefined =
    msg?.images?.[0]?.image_url?.url ?? msg?.images?.[0]?.url ?? undefined;
  if (!url || !url.startsWith("data:image")) throw new Error("The model did not return an image.");
  return url;
}

/* ---------------------------------------------------------- drift check */

export function driftPrompt(payload: SketchPayload): string {
  const geo = payload.geometry
    .map((g) => "- " + g.kind + ": " + g.label + (g.dimension ? " (" + g.dimension + ")" : ""))
    .join("\n");
  return (
    "Two images: the first is an architectural drawing, the second is a render that was supposed to follow it " +
    "exactly.\nThe render mode requested was: " +
    payload.mode +
    ".\nThe geometry that had to be preserved:\n" +
    (geo || "- (none supplied)") +
    "\n\nCompare them and answer only with JSON: " +
    '{"issues": [{"id": string, "severity": "minor" | "major", "detail": string}]}.\n' +
    "Use only these ids and judge each question honestly:\n" +
    DRIFT_CHECKS.map((c) => "- " + c.id + ": " + c.question).join("\n") +
    "\nReturn an empty issues array when the render follows the drawing. " +
    '"major" means the render contradicts the drawing in a way a client would notice. ' +
    "detail is one short sentence naming what drifted and where."
  );
}

export async function inspectSketchDrift(
  drawing: string,
  render: string,
  payload: SketchPayload,
  apiKey: string,
) {
  return askAboutImages(driftPrompt(payload), [drawing, render], apiKey);
}
