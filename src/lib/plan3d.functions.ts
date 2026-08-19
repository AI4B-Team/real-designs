import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * 2D To 3D Plan.
 *
 * Takes the room photograph (or the approved render) and produces a furnished
 * top-down 3D plan of the same space: same footprint, same window and door
 * positions, same furniture layout. Costs 6 credits, refunded on failure.
 */

const Input = z.object({
  image: z.string().min(16),
  room_type: z.string().max(60).default("living room"),
  direction: z.string().max(60).default("Warm Minimal"),
  floor_area_sf: z.number().nullable().optional(),
});

const MODEL = "google/gemini-2.5-flash-image";

export const renderPlan3d = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const { charge, refund, chargeErrorMessage } = await import("@/lib/credits.server");
    const charged = await charge(context.userId, "plan_3d", `3D plan, ${data.room_type}`);
    if (!charged.ok) throw new Error(chargeErrorMessage(charged));

    const prompt = [
      `Convert this ${data.room_type} photograph into a furnished three dimensional floor plan of the same room.`,
      "Render it as a clean top-down dollhouse view with cut-away walls, viewed from about 45 degrees above.",
      "Hard rules: keep the same room footprint and proportions, the same window and door positions, and the same furniture layout and placement as the photograph. Do not invent extra rooms, walls or openings.",
      `Furnishings and finishes follow a ${data.direction} direction.`,
      data.floor_area_sf
        ? `The room is roughly ${Math.round(data.floor_area_sf)} square feet.`
        : "",
      "Neutral studio background, soft even lighting, photoreal materials, no text, no dimensions, no labels, no watermarks.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          modalities: ["image", "text"],
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: data.image } },
              ],
            },
          ],
        }),
      });

      if (res.status === 429) throw new Error("Rate limit reached, try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      if (!res.ok) throw new Error(`3D plan failed (${res.status}).`);

      const payload = (await res.json()) as any;
      const msg = payload?.choices?.[0]?.message;
      const url: string | undefined =
        msg?.images?.[0]?.image_url?.url ?? msg?.images?.[0]?.url ?? undefined;
      if (!url || !url.startsWith("data:image"))
        throw new Error("The model did not return a plan image.");

      return { image: url, charged: charged.charged, balance: charged.balance };
    } catch (err) {
      await refund(context.userId, charged.charged, "3D plan failed");
      throw err;
    }
  });
