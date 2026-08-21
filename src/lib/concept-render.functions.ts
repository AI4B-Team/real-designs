import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Text-first concept rendering.
 *
 * Without a photo, sketch or plan there is no real architecture to preserve,
 * so the result is an original concept, never a redesign of a real space. The
 * UI labels these results "Concept" until the user attaches a real source.
 *
 * One "design" credit is charged BEFORE the call and refunded if it fails.
 */

const Input = z.object({
  prompt: z.string().min(12).max(1200),
  space: z.string().max(40).default("interior"),
  room: z.string().max(60).default("Living Room"),
  dimensions: z.string().max(60).nullable().optional(),
  style: z.string().max(60).nullable().optional(),
  mood: z.string().max(60).nullable().optional(),
  budget: z.string().max(60).nullable().optional(),
  features: z.string().max(400).nullable().optional(),
  /** Optional inspiration image as a data URL. */
  image: z.string().min(16).max(9_000_000).nullable().optional(),
  /** Extra reference images as data URLs, inspiration only. */
  images: z.array(z.string().min(16).max(9_000_000)).max(3).nullable().optional(),
  /** Output framing for the concept. */
  aspect_ratio: z.string().max(8).nullable().optional(),
});


const MODEL = "google/gemini-2.5-flash-image";

function buildPrompt(d: z.infer<typeof Input>): string {
  const lines = [
    `Create an original photorealistic ${d.space} design concept of a ${d.room}.`,
    d.prompt,
  ];
  if (d.dimensions) lines.push(`Approximate dimensions: ${d.dimensions}.`);
  if (d.style) lines.push(`Design style: ${d.style}.`);
  if (d.mood) lines.push(`Mood: ${d.mood}.`);
  if (d.budget)
    lines.push(
      `Furnishing and finish budget: ${d.budget}. Choose finishes that are realistic at that level.`,
    );
  if (d.features) lines.push(`Must-have features: ${d.features}.`);
  if (d.image || (d.images && d.images.length))
    lines.push(
      "Use the attached images only as stylistic inspiration, not as the architecture to reproduce.",
    );
  if (d.aspect_ratio)
    lines.push(
      `Output framing: return the image with a ${d.aspect_ratio} aspect ratio, composed naturally without stretching.`,
    );
  lines.push(
    "Photorealistic architectural photography, natural light, believable materials and proportions. No text, no watermarks, no labels, no people.",
  );
  return lines.join("\n");
}


export const renderConcept = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const { charge, refund, chargeErrorMessage } = await import("@/lib/credits.server");
    const charged = await charge(context.userId, "design", "Text concept");
    if (!charged.ok) throw new Error(chargeErrorMessage(charged));

    try {
      const content: any[] = [{ type: "text", text: buildPrompt(data) }];
      if (data.image) content.push({ type: "image_url", image_url: { url: data.image } });

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          modalities: ["image", "text"],
          messages: [{ role: "user", content }],
        }),
      });

      if (res.status === 429) throw new Error("Rate limit reached, try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      if (!res.ok) throw new Error(`Concept failed (${res.status}).`);

      const payload = (await res.json()) as any;
      const msg = payload?.choices?.[0]?.message;
      const url: string | undefined =
        msg?.images?.[0]?.image_url?.url ?? msg?.images?.[0]?.url ?? undefined;
      if (!url || !url.startsWith("data:image"))
        throw new Error("The model did not return an image.");

      return {
        image: url,
        balance: charged.balance,
        remainingToday: charged.remainingToday ?? null,
        charged: charged.charged,
      };
    } catch (err) {
      await refund(context.userId, charged.charged, "Text concept failed");
      throw err;
    }
  });
