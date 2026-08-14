import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildStylePayload, providerStyleName, type ProjectType } from "@/lib/style-catalog";

/**
 * Real redesign rendering.
 *
 * The model receives the actual room photograph and edits it in place: same
 * camera, same walls, same windows. It never sees or produces a price — money
 * only ever comes out of the SQL estimator.
 *
 * One "design" credit is charged BEFORE the call and refunded if the call fails.
 */

const Input = z.object({
  image: z.string().min(16), // data URL of the source photo
  room_type: z.string().max(60).default("living room"),
  direction: z.string().max(60).default("Warm Minimal"),
  intensity: z.string().max(40).default("Makeover"),
  grade: z.string().max(40).default("Retail Grade"),
  notes: z.string().max(600).nullable().optional(),
  keep: z.array(z.string().max(40)).max(20).default([]),
  replace: z.array(z.string().max(40)).max(20).default([]),
  remove: z.array(z.string().max(40)).max(20).default([]),
  style_id: z.string().max(80).nullable().optional(),
  project_type: z.enum(["interior", "exterior", "garden", "virtual-staging", "concept"]).default("interior"),
  preserve_architecture: z.boolean().default(true),
});

const MODEL = "google/gemini-2.5-flash-image";

function buildPrompt(d: z.infer<typeof Input>): string {
  // The style selection always reaches the model: canonical prompt attributes,
  // never a generic fallback, plus the provider's own name for that style.
  const style = buildStylePayload({
    style: d.style_id || d.direction,
    projectType: d.project_type as ProjectType,
    roomType: d.room_type,
    userPrompt: d.notes || "",
    preserveArchitecture: d.preserve_architecture,
  });
  const providerName = providerStyleName(style.styleId, "gemini") || style.styleName;
  const lines = [
    `Redesign this ${d.room_type} photograph in the ${providerName} style at "${d.intensity}" intensity with ${d.grade} finishes.`,
    `Style definition: ${style.stylePrompt}.`,
    `Avoid: ${style.styleNegativePrompt}.`,
    "Hard rules: keep the exact same camera angle, focal length, perspective, room proportions, window and door positions, ceiling height and natural light direction. This is a redesign of a real space, not a new room. Do not move or resize architecture. Do not add rooms, windows or walls. Photorealistic result, no text, no watermarks, no labels.",
  ];
  if (d.keep.length) lines.push(`Keep these existing objects unchanged: ${d.keep.join(", ")}.`);
  if (d.replace.length) lines.push(`Replace these objects with better versions in the chosen direction: ${d.replace.join(", ")}.`);
  if (d.remove.length) lines.push(`Remove these objects entirely and fill the space naturally: ${d.remove.join(", ")}.`);
  if (d.intensity.toLowerCase().includes("refresh"))
    lines.push("Refresh intensity: cosmetic only — paint, textiles, decor and lighting fixtures. Keep flooring, cabinetry and fixtures in place.");
  if (d.intensity.toLowerCase().includes("full"))
    lines.push("Full remodel intensity: finishes, cabinetry, flooring and fixtures may all change, but the structural shell stays identical.");
  if (d.notes) lines.push(`Owner instructions: ${d.notes}`);
  return lines.join("\n");
}

export const renderDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const { charge, refund, chargeErrorMessage } = await import("@/lib/credits.server");
    const charged = await charge(context.userId, "design", `Design render, ${data.direction}`);
    if (!charged.ok) throw new Error(chargeErrorMessage(charged));

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
                { type: "text", text: buildPrompt(data) },
                { type: "image_url", image_url: { url: data.image } },
              ],
            },
          ],
        }),
      });

      if (res.status === 429) throw new Error("Rate limit reached, try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      if (!res.ok) throw new Error(`Render failed (${res.status}).`);

      const payload = (await res.json()) as any;
      const msg = payload?.choices?.[0]?.message;
      const url: string | undefined =
        msg?.images?.[0]?.image_url?.url ?? msg?.images?.[0]?.url ?? undefined;
      if (!url || !url.startsWith("data:image")) throw new Error("The model did not return an image.");

      return {
        image: url,
        balance: charged.balance,
        remainingToday: charged.remainingToday ?? null,
        charged: charged.charged,
      };
    } catch (err) {
      await refund(context.userId, charged.charged, "Design render failed");
      throw err;
    }
  });
