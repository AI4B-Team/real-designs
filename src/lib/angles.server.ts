/**
 * Server helpers for Angles.
 *
 * Two free reads (understand the room once so every view can be locked to it,
 * and score a finished view against the source) and one charged write (render
 * one camera position). Every prompt lives in @/lib/angles-brief, so the
 * panel, the server and the tests describe the same room.
 */

import {
  CONSISTENCY_CHECKS,
  anglePrompt,
  type AnglePayload,
  type AngleRun,
} from "@/lib/angles-brief";

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

/* ------------------------------------------------------- read the room */

export const CONTINUITY_PROMPT =
  "You are reading one interior image so that additional camera views of the SAME room can be generated without " +
  "anything changing. Answer only with JSON.\n" +
  'Return: {"summary": string, "architecture": string, "windows": string, "furniture": string, ' +
  '"materials": string, "palette": string, "lighting": string, "decor": string, "style": string, ' +
  '"unseen": string[]}.\n' +
  "summary: one sentence naming the room and its shape.\n" +
  "architecture: wall layout, ceiling height and treatment, beams, columns, openings.\n" +
  "windows: how many windows and doors, where they are, their size and what is visible through them.\n" +
  "furniture: each visible piece, its colour and where it sits.\n" +
  "materials: floor, wall, ceiling, counter, cabinet and metal finishes, named exactly.\n" +
  "palette: the dominant colours in plain words.\n" +
  "lighting: light direction, warmth, intensity and apparent time of day.\n" +
  "decor: art, rugs, plants and styling objects.\n" +
  "style: the design style in two or three words.\n" +
  "unseen: short phrases naming the parts of the room the camera cannot see, for example \"the wall behind the camera\".\n" +
  "Describe only what is actually visible. Never invent a feature.";

export async function readRoomContinuity(image: string, apiKey: string) {
  return askAboutImages(CONTINUITY_PROMPT, [image], apiKey);
}

/* ---------------------------------------------------------- render one */

export function buildAnglePrompt(
  payload: AnglePayload,
  run: AngleRun,
  hasReference: boolean,
): string {
  return anglePrompt(payload, run, hasReference);
}

/**
 * Renders one camera view. The source image is attached first and the approved
 * reference view of the same set second, so angle three still matches angle
 * one rather than only matching the original photo.
 */
export async function renderAngleView(
  prompt: string,
  source: string,
  reference: string | null,
  apiKey: string,
): Promise<string> {
  const content: unknown[] = [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: source } },
  ];
  if (reference && reference !== source)
    content.push({ type: "image_url", image_url: { url: reference } });
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

/* ----------------------------------------------------- consistency score */

export function consistencyPrompt(payload: AnglePayload, run: AngleRun): string {
  return (
    "Two images of what should be the SAME room. The first is the source view. The second is a new view " +
    "generated from this camera instruction: " +
    run.directive +
    "\nThe second image is allowed to show parts of the room the first did not, but nothing that appears in both " +
    "may differ.\n\nAnswer only with JSON: " +
    '{"issues": [{"id": string, "severity": "minor" | "major", "detail": string}]}.\n' +
    "Use only these ids and judge each honestly:\n" +
    CONSISTENCY_CHECKS.map((c) => "- " + c.id + ": " + c.question).join("\n") +
    "\nReturn an empty issues array when the two views are clearly the same room with the same design. " +
    '"major" means a client would notice the two photos are not the same property. ' +
    "detail is one short sentence naming exactly what changed."
  );
}

export async function inspectAngleConsistency(
  source: string,
  render: string,
  payload: AnglePayload,
  run: AngleRun,
  apiKey: string,
) {
  return askAboutImages(consistencyPrompt(payload, run), [source, render], apiKey);
}
