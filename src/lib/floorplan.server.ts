/**
 * Server helpers for the Floorplan tool.
 *
 * Three free reads — classify the upload, read its geometry, compare the
 * finished view against that geometry — and one charged write per view. Every
 * prompt that decides the picture is built in @/lib/floorplan-brief so the
 * panel, the server and the tests all agree on what was asked for.
 */

import {
  DRIFT_CHECKS,
  PLAN_ELEMENT_KINDS,
  PLAN_SOURCES,
  floorplanPrompt,
  type FloorplanPayload,
  type FloorplanRun,
} from "@/lib/floorplan-brief";

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
  "You are looking at one uploaded image to decide whether it is a floor plan that can be converted into a " +
  "three dimensional concept. Answer only with JSON.\n" +
  'Return: {"kind": string, "confidence": 0..1, "levels": number, "summary": string, "reason": string, ' +
  '"alternatives": string[]}.\n' +
  "kind must be exactly one of: " +
  PLAN_SOURCES.map((s) => s.id).join(", ") +
  ".\n" +
  PLAN_SOURCES.map((s) => "- " + s.id + ": " + s.blurb).join("\n") +
  "\nlevels: how many separate building levels are drawn on this page. Usually 1.\n" +
  "summary: one sentence describing what the plan shows.\n" +
  "reason: one sentence, only when this cannot be used as a floor plan, explaining why.\n" +
  "alternatives: other plausible kinds when you are unsure. Never guess with high confidence.";

export async function classifyFloorplanSource(image: string, apiKey: string) {
  return askAboutImages(CLASSIFY_PROMPT, [image], apiKey);
}

/* --------------------------------------------------------------- detect */

export const GEOMETRY_PROMPT =
  "You are reading one two dimensional floor plan and extracting its geometry so a renderer can follow it " +
  "exactly. Answer only with JSON.\n" +
  'Return: {"summary": string, "units": "ft" | "m" | "unknown", "scale": {"note": string | null}, ' +
  '"warnings": string[], "floors": [{"id": string, "label": string}], ' +
  '"elements": [{"id": string, "kind": string, "label": string, "floor": string, ' +
  '"box": {"x": number, "y": number, "w": number, "h": number}, "dimension": string | null, ' +
  '"detail": string | null, "confidence": 0..1}]}.\n' +
  "kind must be one of: " +
  PLAN_ELEMENT_KINDS.map((k) => k.id).join(", ") +
  ".\n" +
  PLAN_ELEMENT_KINDS.map((k) => "- " + k.id + ": " + k.blurb).join("\n") +
  "\nbox is that element's bounding box normalized 0..1 with the origin at the top-left of the image.\n" +
  "floors: one entry per building level drawn on this page, in order from lowest to highest. " +
  "Every element must name the floor label it belongs to. When only one level is drawn, return a single floor.\n" +
  'label is what a person would call it, for example "kitchen", "north exterior wall" or "front door".\n' +
  "For rooms, use the name written on the plan when there is one; otherwise name it from its fixtures and say so " +
  "in detail, and lower the confidence.\n" +
  "dimension: the measurement written on the plan for that element, copied exactly, or null. " +
  "Never estimate a dimension and never invent one — if nothing is written, return null.\n" +
  "scale.note: the scale stated on the plan or its scale bar, copied exactly, or null. Do not infer a scale.\n" +
  "confidence: how sure you are that this element is really there and correctly classified.\n" +
  "warnings: short sentences about anything ambiguous, unreadable, cut off or contradictory in the plan.\n" +
  "List every wall run, room, door, window, stair, plumbing fixture, cabinet run, appliance, fireplace, " +
  "written dimension, room label and scale note you can actually see. Never invent an element that is not drawn.";

export async function detectFloorplanGeometry(image: string, apiKey: string) {
  return askAboutImages(GEOMETRY_PROMPT, [image], apiKey);
}

/* --------------------------------------------------------------- render */

export function buildFloorplanPrompt(payload: FloorplanPayload, run: FloorplanRun | null): string {
  return floorplanPrompt(payload, run);
}

/**
 * Renders one view. The plan is attached first and any reference image from an
 * earlier view of the same plan second, so finishes and furniture carry across
 * every view in the set.
 */
export async function renderFloorplanView(
  prompt: string,
  plan: string,
  reference: string | null,
  apiKey: string,
): Promise<string> {
  const content: unknown[] = [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: plan } },
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

export function driftPrompt(payload: FloorplanPayload): string {
  const geo = payload.geometry
    .map((g) => "- " + g.kind + ": " + g.label + (g.dimension ? " (" + g.dimension + ")" : ""))
    .join("\n");
  return (
    "Two images: the first is a two dimensional floor plan, the second is a three dimensional concept that was " +
    "supposed to follow it exactly.\nThe requested output was: " +
    payload.output_label +
    " of " +
    payload.floor_label +
    ".\nThe geometry that had to be preserved:\n" +
    (geo || "- (none supplied)") +
    "\n\nCompare them and answer only with JSON: " +
    '{"issues": [{"id": string, "severity": "minor" | "major", "detail": string}]}.\n' +
    "Use only these ids and judge each question honestly:\n" +
    DRIFT_CHECKS.map((c) => "- " + c.id + ": " + c.question).join("\n") +
    "\nReturn an empty issues array when the concept follows the plan. " +
    '"major" means the concept contradicts the plan in a way a client would notice, such as a missing room, ' +
    "a rearranged layout or an invented wall. detail is one short sentence naming what drifted and where. " +
    "Judge layout and structure only — furniture, styling and finishes are free choices and are never issues."
  );
}

export async function inspectFloorplanDrift(
  plan: string,
  render: string,
  payload: FloorplanPayload,
  apiKey: string,
) {
  return askAboutImages(driftPrompt(payload), [plan, render], apiKey);
}
