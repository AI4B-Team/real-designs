import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildStylePayload, providerStyleName, type ProjectType } from "@/lib/style-catalog";
import { spacePromptIntro, spacePromptRules } from "@/lib/space-tools";
import {
  intensityById,
  intensityRule,
  lockedElements,
  sanitizeUnlocked,
} from "@/lib/redesign-brief";

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
  /* Canonical intensity id: refresh | makeover | renovation | reimagine. */
  intensity_id: z.string().max(30).nullable().optional(),
  /* Reality Lock elements the user explicitly unlocked. */
  unlocked: z.array(z.string().max(30)).max(20).default([]),
  /* Internal tool identifier, e.g. "Redesign" or "Virtual Stage". */
  tool: z.string().max(40).default("Redesign"),
  project_type: z
    .enum(["interior", "exterior", "garden", "virtual-staging", "concept"])
    .default("interior"),
  preserve_architecture: z.boolean().default(true),
  /* Photo Design output ratio. "original" keeps the source aspect ratio. */
  aspect_ratio: z.enum(["original", "1:1", "4:3", "3:2", "16:9", "5:4", "4:5", "2:3", "9:16"]).default("original"),
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
    spacePromptIntro(d.project_type, d.tool, d.room_type, providerName) +
      ` Work at "${d.intensity}" intensity with ${d.grade} finishes.`,
    `Style definition: ${style.stylePrompt}.`,
    `Avoid: ${style.styleNegativePrompt}.`,
    ...spacePromptRules(d.project_type),
    intensityRule(d.intensity_id || d.intensity),
    "Reality Lock — preserve exactly: " +
      lockedElements(d.unlocked)
        .map((e) => e.label.toLowerCase())
        .join(", ") +
      ". This is a redesign of a real, photographed space, not a new room. Do not move or resize architecture, do not add rooms and do not invent an unrelated space.",
    "Output quality: photorealistic, natural light behaviour, realistic scale, coherent shadows and plausible materials. No people unless requested. No text, logos, labels or watermarks. No impossible furniture placement.",
  ];
  const unlocked = sanitizeUnlocked(d.unlocked);
  if (unlocked.length)
    lines.push(
      `The owner explicitly unlocked these elements, so you may change them if the design calls for it: ${unlocked.join(", ")}. Everything else stays exactly as photographed.`,
    );
  if (d.keep.length) lines.push(`Keep these existing objects unchanged: ${d.keep.join(", ")}.`);
  if (d.replace.length)
    lines.push(
      `Replace these objects with better versions in the chosen direction: ${d.replace.join(", ")}.`,
    );
  if (d.remove.length)
    lines.push(
      `Remove these objects entirely and fill the space naturally: ${d.remove.join(", ")}.`,
    );
  if (d.aspect_ratio && d.aspect_ratio !== "original")
    lines.push(
      `Output framing: return the image with a ${d.aspect_ratio} aspect ratio, recomposing the same view without distorting or stretching it.`,
    );
  else
    lines.push(
      "Output framing: keep the original aspect ratio and framing of the source photograph.",
    );
  if (d.notes) lines.push(`Owner instructions: ${d.notes}`);
  return lines.join("\n");
}

export const renderDesign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const unlocked = sanitizeUnlocked(data.unlocked);
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
      if (!url || !url.startsWith("data:image"))
        throw new Error("The model did not return an image.");

      return {
        image: url,
        intensity: intensityById(data.intensity_id || data.intensity).id,
        unlocked,
        balance: charged.balance,
        remainingToday: charged.remainingToday ?? null,
        charged: charged.charged,
      };
    } catch (err) {
      await refund(context.userId, charged.charged, "Design render failed");
      throw err;
    }
  });
