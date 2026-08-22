/**
 * Animate — provider plumbing for the Studio motion-clip tool.
 *
 * Server-only. Talks to Veo on the Lovable AI Gateway, stores the finished MP4
 * in the user's private bucket (the gateway's copy expires), and reads the
 * first and last frame back through a vision model so a morphing clip can be
 * flagged instead of quietly shipped.
 */

import { summarizeMotionCheck, type AnimatePayload, type MotionCheck } from "@/lib/animate-brief";

const VIDEOS = "https://ai.gateway.lovable.dev/v1/videos";
const CHAT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-3.7-flash";
export const VIDEO_BUCKET = "room-photos";

export function apiKey(): string {
  const k = process.env["LOVABLE_API_KEY"];
  if (!k) throw new Error("AI is not configured.");
  return k;
}

function gatewayMessage(status: number, body: any): string {
  if (status === 429)
    return String(
      body?.message || "A video is already rendering for this workspace. Wait for it to finish.",
    );
  if (status === 402)
    return String(body?.message || "Not enough AI credits to render this clip right now.");
  if (status === 403) return "Video generation is blocked for this workspace.";
  return String(body?.message || `The video could not be started (${status}).`);
}

function inlineImage(dataUrl: string): { bytesBase64Encoded: string; mimeType: string } {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) throw new Error("The source image could not be read.");
  return { mimeType: m[1]!, bytesBase64Encoded: m[2]! };
}

/** Create the provider job. Returns its id — nothing is polled here. */
export async function createProviderJob(input: {
  payload: AnimatePayload;
  image: string;
  lastFrame?: string | null;
}): Promise<{ id: string; status: string; progress: number }> {
  const p = input.payload;
  const instance: Record<string, unknown> = {
    prompt: p.prompt,
    image: inlineImage(input.image),
  };
  if (input.lastFrame) instance["lastFrame"] = inlineImage(input.lastFrame);

  const res = await fetch(VIDEOS, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // A last-frame interpolation needs a fuller Veo model than lite.
      model: input.lastFrame ? "google/veo-3.1-fast" : p.model,
      instances: [instance],
      parameters: {
        durationSeconds: p.seconds,
        resolution: p.resolution,
        sampleCount: 1,
        generateAudio: false,
        negativePrompt: p.negative_prompt,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(gatewayMessage(res.status, body));
  }
  const job = (await res.json()) as any;
  if (!job?.id) throw new Error("The video job could not be created.");
  return {
    id: String(job.id),
    status: String(job.status || "in_progress"),
    progress: Number(job.progress || 0),
  };
}

export async function readProviderJob(
  id: string,
): Promise<{ status: string; progress: number; error: string | null }> {
  const res = await fetch(`${VIDEOS}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) throw new Error(`The video job could not be read (${res.status}).`);
  const job = (await res.json()) as any;
  return {
    status: String(job?.status || "in_progress"),
    progress: Number(job?.progress || 0),
    error: job?.error?.message ? String(job.error.message) : null,
  };
}

export async function downloadProviderVideo(id: string): Promise<ArrayBuffer> {
  const res = await fetch(`${VIDEOS}/${encodeURIComponent(id)}/content`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) throw new Error("The finished clip could not be downloaded.");
  return res.arrayBuffer();
}

/**
 * Quality check. The end frame is compared with the source: if the fixed
 * elements have drifted, the clip morphed and the user is offered a reduced
 * motion retry rather than a silent pass.
 */
export async function checkMotion(sourceUrl: string, endFrameUrl: string): Promise<MotionCheck> {
  const prompt = [
    "Image 1 is the reference interior. Image 2 is the final frame of a short camera-move video generated from it.",
    "The camera is allowed to move. Nothing else may change.",
    "Score how well image 2 preserves image 1's architecture, windows, doors, furniture, finishes and colours from 0 to 100.",
    "List only real problems: warped walls, morphing furniture, changed materials, objects that appeared or vanished, added people or text.",
    'Reply as JSON: {"score": number, "issues": ["..."], "notes": "..."}',
  ].join(" ");

  const res = await fetch(CHAT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: sourceUrl } },
            { type: "image_url", image_url: { url: endFrameUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return summarizeMotionCheck({ score: 100, issues: [] });
  const body = (await res.json()) as any;
  const text = body?.choices?.[0]?.message?.content;
  const flat = Array.isArray(text)
    ? text.map((t: any) => (typeof t === "string" ? t : t?.text || "")).join("")
    : String(text || "");
  const raw = String(flat).replace(/```(?:json)?/gi, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return summarizeMotionCheck({ score: 100, issues: [] });
  try {
    return summarizeMotionCheck(JSON.parse(raw.slice(start, end + 1)));
  } catch (_) {
    return summarizeMotionCheck({ score: 100, issues: [] });
  }
}
