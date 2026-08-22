/**
 * Privacy Blur detection.
 *
 * A free, read-only vision pass that names WHERE sensitive content is, never
 * WHAT it says. The prompt forbids transcription on purpose: no OCR text ever
 * comes back, so none of it can be stored, logged or analysed.
 */

import { PRIVACY_CATEGORIES, type PrivacyCategory, type PrivacyDetection } from "@/lib/privacy-blur";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-3.7-flash";

function gatewayError(status: number): Error {
  if (status === 429) return new Error("Rate limit reached, try again in a moment.");
  if (status === 402) return new Error("AI credits exhausted for this workspace.");
  if (status === 403) return new Error("AI access is blocked for this workspace.");
  return new Error(`The privacy scan failed (${status}).`);
}

export const PRIVACY_DETECT_PROMPT =
  "You are inspecting one real estate photograph for content that must be obscured before publication. " +
  "Answer only with JSON.\n" +
  'Return: {"items": [{"category": string, "box": {"x": number, "y": number, "w": number, "h": number}, ' +
  '"confidence": 0..1}]}.\n' +
  "category must be one of: " +
  PRIVACY_CATEGORIES.filter((c) => c.id !== "other")
    .map((c) => `${c.id} (${c.hint})`)
    .join(", ") +
  ', or "other".\n' +
  "box is the tight bounding box normalized 0..1 with the origin at the top-left.\n" +
  "NEVER transcribe, quote, summarize or describe any text, name, address, number or face you can see. " +
  "Report only the category and the location. Never invent an item that is not visible.";

const CATEGORY_IDS = new Set(PRIVACY_CATEGORIES.map((c) => c.id));

function num(v: unknown, lo: number, hi: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/** Normalizes the model answer into detections that carry no content at all. */
export function normalizePrivacyDetections(raw: unknown): PrivacyDetection[] {
  const items = Array.isArray((raw as any)?.items) ? ((raw as any).items as unknown[]) : [];
  const out: PrivacyDetection[] = [];
  items.slice(0, 40).forEach((it: any, i) => {
    const cat = String(it?.category || "other").toLowerCase();
    const category = (CATEGORY_IDS.has(cat as PrivacyCategory) ? cat : "other") as PrivacyCategory;
    const b = it?.box || {};
    const box = {
      x: num(b.x, 0, 1),
      y: num(b.y, 0, 1),
      w: num(b.w, 0.005, 1),
      h: num(b.h, 0.005, 1),
    };
    if (box.x + box.w > 1) box.w = Math.max(0.005, 1 - box.x);
    if (box.y + box.h > 1) box.h = Math.max(0.005, 1 - box.y);
    out.push({
      id: `pv${i + 1}`,
      label: PRIVACY_CATEGORIES.find((c) => c.id === category)?.label || "Other",
      confidence: num(it?.confidence, 0, 1) || 0.6,
      box,
      category,
    });
  });
  return out;
}

export async function detectPrivacyRegions(image: string, apiKey: string): Promise<PrivacyDetection[]> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PRIVACY_DETECT_PROMPT },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw gatewayError(res.status);
  const payload = (await res.json()) as any;
  const content = payload?.choices?.[0]?.message?.content;
  const flat = Array.isArray(content)
    ? content.map((p: any) => (typeof p === "string" ? p : p?.text || "")).join("")
    : String(content || "");
  const cleaned = flat.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    return normalizePrivacyDetections(JSON.parse(cleaned.slice(start, end + 1)));
  } catch (_) {
    return [];
  }
}
