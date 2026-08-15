import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Social caption writer.
 *
 * Turns an asset's context (property, room, style, format) into a ready to post
 * caption plus hashtags for one platform. Text only — no credits are consumed.
 */

const Input = z.object({
  platform: z.enum(["instagram", "tiktok", "facebook", "linkedin", "youtube"]),
  tone: z.enum(["professional", "friendly", "luxury", "punchy"]).default("friendly"),
  kind: z.enum(["image", "video"]).default("image"),
  title: z.string().max(160).nullable().optional(),
  room: z.string().max(80).nullable().optional(),
  style: z.string().max(80).nullable().optional(),
  property: z.string().max(160).nullable().optional(),
  notes: z.string().max(400).nullable().optional(),
});

const Out = z.object({
  hook: z.string().max(160),
  caption: z.string().max(1200),
  hashtags: z.array(z.string().max(40)).max(14),
  cta: z.string().max(160),
});

const LIMITS: Record<string, string> = {
  instagram: "Up to 4 short lines with line breaks, 8 to 12 hashtags.",
  tiktok: "One or two punchy lines under 150 characters, 4 to 6 hashtags.",
  facebook: "Two to three conversational sentences, 2 to 4 hashtags.",
  linkedin: "Three to four professional sentences, no emojis, 3 to 5 hashtags.",
  youtube: "A title-style hook then two descriptive sentences, 4 to 6 hashtags.",
};

export const generateSocialCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const ctx = [
      `Asset type: ${data.kind === "video" ? "property video" : "property photo or design render"}.`,
      data.title ? `Asset title: ${data.title}.` : "",
      data.room ? `Space: ${data.room}.` : "",
      data.style ? `Design style: ${data.style}.` : "",
      data.property ? `Property: ${data.property}.` : "",
      data.notes ? `Extra context: ${data.notes}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write social captions for real estate agents, investors and designers. " +
              "Never invent prices, square footage, addresses or claims that were not given to you. " +
              "If the visual is an AI design or virtually staged render, keep the copy honest about it being a concept. " +
              "Return only the requested fields.",
          },
          {
            role: "user",
            content:
              `Platform: ${data.platform}. Tone: ${data.tone}. ${LIMITS[data.platform]} ` +
              `${ctx} Write the caption now.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "write_caption",
              description: "Return the finished social post copy.",
              parameters: {
                type: "object",
                properties: {
                  hook: { type: "string", description: "Scroll-stopping first line." },
                  caption: { type: "string", description: "Full caption body, hashtags excluded." },
                  hashtags: { type: "array", items: { type: "string" }, description: "Hashtags without the # symbol." },
                  cta: { type: "string", description: "Short call to action." },
                },
                required: ["hook", "caption", "hashtags", "cta"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "write_caption" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    if (!res.ok) throw new Error(`Caption service error (${res.status}).`);

    const json: any = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("The caption service returned nothing usable.");

    const parsed = Out.parse(JSON.parse(args));
    return {
      ...parsed,
      hashtags: parsed.hashtags.map((h) => h.replace(/^#+/, "").trim()).filter(Boolean),
    };
  });
