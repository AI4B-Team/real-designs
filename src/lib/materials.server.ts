/**
 * Server helpers for Materials: the free surface-detection pass, the masked
 * single-surface swap render and the free post-generation inspection.
 *
 * Prompt construction lives in @/lib/materials-brief so the client, the server
 * and the tests all read the same rules.
 */

import { SURFACE_KINDS } from "@/lib/materials-catalog";
import {
  QUALITY_CHECKS,
  materialsPrompt,
  type MaterialsPayload,
  type MaterialsRun,
} from "@/lib/materials-brief";

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
  const raw = String(text || "");
  const fenced = raw.replace(/```(?:json)?/gi, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as Record<string, unknown>;
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

/* -------------------------------------------------------------- detect */

export const DETECT_PROMPT =
  "You are inspecting one real estate photograph to list the replaceable surfaces in it. Answer only with JSON.\n" +
  'Return: {"room_type": string, "summary": string, "lighting": string, "other_surfaces": string[], ' +
  '"surfaces": [{"id": string, "label": string, "kind": string, "current_material": string, ' +
  '"box": {"x": number, "y": number, "w": number, "h": number}, "confidence": 0..1}]}.\n' +
  "kind must be one of: " +
  SURFACE_KINDS.map((s) => s.id).join(", ") +
  ".\n" +
  "label is what a homeowner would call it, for example \"kitchen floor\" or \"island counter\".\n" +
  "current_material names the material actually there today, for example \"mid-tone oak plank\" or " +
  '"speckled beige granite".\n' +
  "box is the surface's bounding box normalized 0..1 with the origin at the top-left of the image, covering " +
  "only the visible extent of that surface.\n" +
  "lighting: one sentence about the direction, quality and colour of the light, so a replacement material can " +
  "be lit the same way.\n" +
  "other_surfaces: short descriptions of every other visible finish that must not change.\n" +
  "Only list surfaces that are genuinely visible. Never invent a surface.";

export async function detectSurfaceList(image: string, apiKey: string) {
  return askAboutImages(DETECT_PROMPT, [image], apiKey);
}

/* -------------------------------------------------------------- render */

export function buildMaterialsPrompt(payload: MaterialsPayload, run: MaterialsRun | null): string {
  return materialsPrompt(payload, run);
}

/**
 * Runs one swap. The rendered mask overlay is attached as a second image; the
 * prompt already tells the model that the magenta region is the only editable
 * area and the green outlines are untouchable.
 */
export async function renderMaterialSwap(
  prompt: string,
  image: string,
  overlay: string | null,
  apiKey: string,
): Promise<string> {
  const content: unknown[] = [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: image } },
  ];
  if (overlay) content.push({ type: "image_url", image_url: { url: overlay } });
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

/* -------------------------------------------------------- quality check */

export const QUALITY_PROMPT =
  "Two photographs of the same space: the first is the original, the second is the result after one surface " +
  "was digitally replaced with a different material.\n" +
  "The only intended change is that one named surface received a new material. Inspect the result and answer " +
  'only with JSON: {"issues": [{"id": string, "severity": "minor" | "major", "detail": string}]}.\n' +
  "Use only these ids and judge each question honestly:\n" +
  QUALITY_CHECKS.map((c) => `- ${c.id}: ${c.question}`).join("\n") +
  "\nReturn an empty issues array when the swap is clean. " +
  '"major" means a viewer would immediately see the fault. detail is one short sentence naming what is wrong and where.';

export async function inspectMaterialSwap(before: string, after: string, apiKey: string) {
  return askAboutImages(QUALITY_PROMPT, [before, after], apiKey);
}
