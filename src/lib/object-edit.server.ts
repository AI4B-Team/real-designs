/**
 * Server helpers for Object Edit: the free detection pass that names every
 * object, the masked render, and the free preservation inspection that proves
 * only the selection changed.
 *
 * Prompt construction lives in @/lib/object-edit-brief so the client, the
 * server and the tests read the same rules.
 */

import { PRESERVATION_CHECKS, objectEditPrompt, type ObjectEditPayload } from "@/lib/object-edit-brief";
import { maskContent } from "@/lib/mask-content.server";

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
  const fenced = String(text || "").replace(/```(?:json)?/gi, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as Record<string, unknown>;
  } catch (_) {
    return {};
  }
}

async function askAboutImages(prompt: string, images: string[], apiKey: string) {
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

/* -------------------------------------------------------------- detect */

export const DETECT_PROMPT =
  "You are inspecting one interior photograph so a user can select a single object to edit. " +
  "Answer only with JSON.\n" +
  'Return: {"room_type": string, "surfaces": string[], "objects": [{"label": string, "category": string, ' +
  '"box": {"x": number, "y": number, "w": number, "h": number}, "confidence": 0..1, "movable": boolean, ' +
  '"architectural": boolean}]}.\n' +
  "label is a specific, human name for the object, for example \"Gray Sectional Sofa\" or \"Left Window\". " +
  "Never answer with a generic name like \"object\".\n" +
  "box is the object's bounding box normalized 0..1 with the origin at the top-left.\n" +
  "movable is true only for free-standing objects that a person could physically move. " +
  "architectural is true for walls, floors, ceilings, windows, doors, trim, stairs, built-ins and plumbing fixtures.\n" +
  "surfaces: short descriptions of the real floor, wall, counter and cabinet materials visible, so an edited " +
  "area can be rebuilt with the correct material.\n" +
  "List every distinct object and surface a user might plausibly want to edit. Never invent objects.";

export async function detectEditableObjects(image: string, apiKey: string) {
  return askAboutImages(DETECT_PROMPT, [image], apiKey);
}

/* -------------------------------------------------------------- render */

export function buildObjectEditPrompt(payload: ObjectEditPayload): string {
  return objectEditPrompt(payload);
}

/**
 * Runs one targeted edit. The mask overlay, when the client could render one,
 * is attached as a second image; the prompt already tells the model that the
 * magenta region is the only editable area and green outlines are protected.
 */
export async function renderObjectEdit(
  prompt: string,
  image: string,
  overlay: string | null,
  mask: string | null,
  apiKey: string,
): Promise<string> {
  const content = maskContent(prompt, image, overlay, mask);
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
  const url: string | undefined = msg?.images?.[0]?.image_url?.url ?? msg?.images?.[0]?.url ?? undefined;
  if (!url || !url.startsWith("data:image")) throw new Error("The model did not return an image.");
  return url;
}

/* --------------------------------------------------- preservation check */

export const PRESERVATION_PROMPT =
  "Two photographs of the same room: the first is the original, the second is the result of one targeted edit.\n" +
  "Only the selected target was supposed to change. Inspect the result and answer only with JSON: " +
  '{"drift": 0..1, "issues": [{"id": string, "severity": "minor" | "major", "detail": string}]}.\n' +
  "drift is your honest estimate of how much of the image OUTSIDE the intended target changed, " +
  "where 0 means nothing else changed and 1 means the whole photo was regenerated.\n" +
  "Use only these ids and judge each question honestly:\n" +
  PRESERVATION_CHECKS.map((c) => `- ${c.id}: ${c.question}`).join("\n") +
  "\nReturn an empty issues array when only the target changed. " +
  '"major" means a viewer would immediately see the fault. detail is one short sentence naming what changed and where.';

export async function inspectObjectEdit(before: string, after: string, apiKey: string) {
  return askAboutImages(PRESERVATION_PROMPT, [before, after], apiKey);
}
