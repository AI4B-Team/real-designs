import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Rewrites a short design description into a richer prompt.
 *
 * Text only, no image generation, so nothing is charged in credits.
 */

const Input = z.object({
  prompt: z.string().min(2).max(1200),
  space: z.string().max(40).nullable().optional(),
});

export const improveDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You rewrite short interior, exterior and landscape design ideas into one vivid, concrete prompt for an image model. Keep the user's intent. Add layout, materials, finishes, colors, lighting and mood. 60 words maximum. Reply with the rewritten description only, no preamble, no quotes, no lists.",
          },
          {
            role: "user",
            content: (data.space ? `Space type: ${data.space}\n` : "") + data.prompt,
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached, try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    if (!res.ok) throw new Error(`Could not improve that description (${res.status}).`);

    const payload = (await res.json()) as any;
    const text: string = payload?.choices?.[0]?.message?.content ?? "";
    const clean = String(text).trim().replace(/^["']|["']$/g, "");
    if (!clean) throw new Error("The model did not return a description.");
    return { prompt: clean };
  });
