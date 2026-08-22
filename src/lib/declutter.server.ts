/**
 * Server helpers for Declutter: the free detection pass, the masked removal
 * render and the free post-generation inspection.
 *
 * Prompt construction lives in @/lib/declutter-brief so the client, the server
 * and the tests all read the same rules.
 */

import {
  CLUTTER_CATEGORIES,
  PROTECTED_CLASSES,
  QUALITY_CHECKS,
  declutterPrompt,
  type DeclutterPayload,
  type DeclutterRun,
} from "@/lib/declutter-brief";
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
  "You are inspecting one real estate photograph to find clutter that should be removed before listing. " +
  "Answer only with JSON.\n" +
  'Return: {"room_type": string, "summary": string, "surfaces": string[], "items": [{"label": string, ' +
  '"category": string, "box": {"x": number, "y": number, "w": number, "h": number}, "confidence": 0..1, ' +
  '"furniture": boolean}]}.\n' +
  "category must be one of: " +
  CLUTTER_CATEGORIES.map((c) => c.id + " (" + c.hint + ")").join(", ") +
  ", or \"other\".\n" +
  "box is the object's bounding box normalized 0..1 with the origin at the top-left of the image.\n" +
  "furniture must be true when the object is " +
  PROTECTED_CLASSES.join(", ") +
  " — those are never clutter, but list them so they can be protected.\n" +
  "surfaces: short descriptions of the real floor, wall, counter and cabinet materials visible, so a removed " +
  "object's area can be filled with the correct material.\n" +
  "List every genuinely loose or personal object you can see, one entry each. Never invent objects. " +
  "summary is one honest sentence about how cluttered the room is.";

export async function detectClutterItems(image: string, apiKey: string) {
  return askAboutImages(DETECT_PROMPT, [image], apiKey);
}

/* -------------------------------------------------------------- render */

export function buildDeclutterPrompt(payload: DeclutterPayload, run: DeclutterRun | null): string {
  return declutterPrompt(payload, run);
}

/**
 * Runs one removal. The mask overlay, when the client could render one, is
 * attached as a second image; the prompt already tells the model that the
 * magenta regions are the only editable area.
 */
export async function renderDecluttered(
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
  const url: string | undefined =
    msg?.images?.[0]?.image_url?.url ?? msg?.images?.[0]?.url ?? undefined;
  if (!url || !url.startsWith("data:image")) throw new Error("The model did not return an image.");
  return url;
}

/* -------------------------------------------------------- quality check */

export const QUALITY_PROMPT =
  "Two photographs of the same room: the first is the original, the second is the decluttered result.\n" +
  "The only intended change is that selected loose objects were removed and the real surface behind them " +
  "rebuilt. Inspect the result and answer only with JSON: " +
  '{"issues": [{"id": string, "severity": "minor" | "major", "detail": string}]}.\n' +
  "Use only these ids and judge each question honestly:\n" +
  QUALITY_CHECKS.map((c) => `- ${c.id}: ${c.question}`).join("\n") +
  "\nReturn an empty issues array when the cleanup is clean. " +
  '"major" means a viewer would immediately see the fault. detail is one short sentence naming the object and where it is.';

export async function inspectDecluttered(before: string, after: string, apiKey: string) {
  return askAboutImages(QUALITY_PROMPT, [before, after], apiKey);
}
