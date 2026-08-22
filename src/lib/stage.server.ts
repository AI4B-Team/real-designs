/**
 * Server helpers for Virtual Stage: the room-understanding pass, the staged
 * render call and the post-generation quality inspection.
 *
 * Prompt construction lives in @/lib/stage-brief so the client, the server and
 * the tests all read the same rules.
 */

import {
  FEATURE_IDS,
  FEATURE_LABEL,
  QUALITY_CHECKS,
  stagePrompt,
  type StagePayload,
  type StageRun,
} from "@/lib/stage-brief";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-3.7-flash";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";

function gatewayError(status: number): Error {
  if (status === 429) return new Error("Rate limit reached, try again in a moment.");
  if (status === 402) return new Error("AI credits exhausted for this workspace.");
  if (status === 403) return new Error("AI access is blocked for this workspace.");
  return new Error(`The AI request failed (${status}).`);
}

/** Parses the first JSON object out of a text answer. */
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

/* ------------------------------------------------------------- analysis */

export const ANALYSIS_PROMPT =
  "You are inspecting one real estate photograph before virtual staging. Answer only with JSON.\n" +
  'Return: {"room_type": string, "occupancy": "empty" | "partial" | "furnished", "confidence": 0..1, ' +
  '"features": string[], "furniture": string[], "zones": string[], "summary": string}.\n' +
  "occupancy: \"empty\" when there is no loose furniture at all (built-ins and appliances do not count), " +
  '"partial" when one or two loose pieces are present, "furnished" when the room is in normal use.\n' +
  "features must be chosen only from: " +
  FEATURE_IDS.join(", ") +
  " — include an id only when that element is genuinely visible.\n" +
  "furniture: short names of the loose furniture and décor actually visible, empty array when none.\n" +
  "zones: up to four short descriptions of the usable, unobstructed floor areas where furniture could stand, " +
  'each naming its position in the frame, e.g. "open floor along the left wall under the windows".\n' +
  "summary: one honest sentence about the room. Never invent anything that is not in the photograph.";

export async function analyzeRoom(image: string, apiKey: string) {
  return askAboutImages(ANALYSIS_PROMPT, [image], apiKey);
}

/* --------------------------------------------------------------- render */

export function buildStagePrompt(payload: StagePayload, run: StageRun | null): string {
  return stagePrompt(payload, run);
}

export async function renderStagedImage(
  prompt: string,
  image: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
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

/* -------------------------------------------------------- quality checks */

export const QUALITY_PROMPT =
  "Two photographs of the same room: the first is the original, the second is the virtually staged result.\n" +
  "Inspect the staged result against the original and answer only with JSON: " +
  '{"issues": [{"id": string, "severity": "minor" | "major", "detail": string}]}.\n' +
  "Use only these ids and judge each question honestly:\n" +
  QUALITY_CHECKS.map((c) => `- ${c.id}: ${c.question}`).join("\n") +
  "\nReturn an empty issues array when the staged result is clean. " +
  '"major" means a viewer would immediately see the fault. detail is one short sentence naming the object and where it is.';

export async function inspectStagedResult(before: string, after: string, apiKey: string) {
  return askAboutImages(QUALITY_PROMPT, [before, after], apiKey);
}

export const FEATURE_LABELS = FEATURE_LABEL;
