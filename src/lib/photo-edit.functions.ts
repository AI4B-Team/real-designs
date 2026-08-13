import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Property photo AI edits.
 *
 * Two families, kept apart on purpose:
 *  - Property AI  → improves the real photograph (Enhanced / Digitally Altered)
 *  - Design AI    → materially changes or stages the property (Virtually Staged,
 *                   AI-Generated Concept, Proposed Design)
 *
 * The caller passes the operation key; the classification returned here is what
 * the client writes onto the saved version, so an altered image can never be
 * filed as an unmodified original.
 */

export const PROPERTY_OPS = {
  auto_enhance: "Auto Enhance",
  window_balance: "Window Balance",
  hdr_merge: "HDR Merge",
  sky: "Sky Enhancement",
  lawn: "Lawn Enhancement",
  dusk: "Day To Dusk",
  object_removal: "Object Removal",
  declutter: "Declutter",
  privacy_blur: "Privacy Blur",
  reflection: "Remove Camera Reflection",
  tv_off: "Turn Off TV",
  fireplace: "Add Fire To Fireplace",
  perspective: "Perspective Correction",
  white_balance: "White-Balance Correction",
  lens: "Lens Correction",
  noise: "Noise Reduction",
  sharpen: "Sharpening",
} as const;

export const DESIGN_OPS = {
  stage: "Virtual Stage",
  redesign: "Redesign",
  empty_room: "Empty Room",
  replace_furniture: "Replace Furniture",
  exterior: "Exterior Design",
  landscape: "Garden Design",
  renovation: "Renovation Visualization",
} as const;

const DESIGN_CLASS: Record<string, string> = {
  stage: "Virtually Staged",
  redesign: "Proposed Design",
  empty_room: "Digitally Altered",
  replace_furniture: "Virtually Staged",
  exterior: "Proposed Design",
  landscape: "Proposed Design",
  renovation: "Renovation Visualization",
};

const HEAVY_PROPERTY_OPS = new Set(["object_removal", "declutter", "dusk", "fireplace", "tv_off"]);

const Input = z.object({
  family: z.enum(["property", "design"]),
  op: z.string().min(2).max(40),
  image: z.string().min(16),
  room: z.string().max(60).default("Living Room"),
  direction: z.string().max(60).default("Warm Minimal"),
  instruction: z.string().max(600).nullable().optional(),
});

function prompt(d: z.infer<typeof Input>, label: string): string {
  const base = `You are editing a real estate photograph of a ${d.room}. Keep the camera position, focal length and framing exactly as shot. Output one photorealistic image at the same aspect ratio.`;
  const extra = d.instruction ? ` Additional instruction from the user: ${d.instruction}.` : "";
  if (d.family === "property") {
    return `${base} Apply this correction only: ${label}. Do not add, remove, restyle or replace furniture, fixtures, finishes, structure or landscaping. Do not change what the property actually is — this must remain a truthful photograph of the space.${extra}`;
  }
  return `${base} Produce a ${label} visualization in a ${d.direction} direction. Preserve the room architecture, window and door positions, ceiling height and permanent structure. It is acceptable to change furnishings, décor, finishes or landscaping as required by the requested visualization.${extra}`;
}

export const runPhotoEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const label =
      data.family === "property"
        ? (PROPERTY_OPS as Record<string, string>)[data.op]
        : (DESIGN_OPS as Record<string, string>)[data.op];
    if (!label) throw new Error("That edit is not available.");

    const { callImageModel } = await import("@/lib/room-tools.server");
    const { charge, refund, chargeErrorMessage } = await import("@/lib/credits.server");

    const charged = await charge(context.userId, "design", label);
    if (!charged.ok) throw new Error(chargeErrorMessage(charged));

    try {
      const image = await callImageModel(prompt(data, label), data.image, apiKey);
      const modification_class =
        data.family === "design"
          ? (DESIGN_CLASS[data.op] ?? "Proposed Design")
          : HEAVY_PROPERTY_OPS.has(data.op)
            ? "Digitally Altered"
            : "Enhanced";
      return {
        image,
        label,
        family: data.family,
        modification_class,
        balance: charged.balance,
        remainingToday: charged.remainingToday ?? null,
      };
    } catch (err) {
      await refund(context.userId, charged.charged, `${label} failed`);
      throw err;
    }
  });

/**
 * Natural-language editor. Interprets a free-text request into the concrete
 * operations we support so the user can review them before anything is charged.
 * No image is generated here and no credit is spent.
 */
export const interpretPhotoRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ request: z.string().min(3).max(600) }).parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const catalog = [
      ...Object.entries(PROPERTY_OPS).map(([k, v]) => `property:${k} = ${v}`),
      ...Object.entries(DESIGN_OPS).map(([k, v]) => `design:${k} = ${v}`),
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Map a real estate photo editing request onto this catalog:\n${catalog}\nReturn JSON only: {"steps":[{"family":"property|design","op":"key","label":"short human label"}],"summary":"one sentence","material":true|false}. "material" is true when any step would materially change, stage or redesign the property. Never invent operations outside the catalog. Return at most 3 steps.`,
          },
          { role: "user", content: data.request },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("Rate limit reached, try again in a moment.");
    if (!res.ok) throw new Error(`Could not read that request (${res.status}).`);
    const payload = (await res.json()) as any;
    let parsed: any = {};
    try {
      parsed = JSON.parse(payload?.choices?.[0]?.message?.content ?? "{}");
    } catch {
      parsed = {};
    }
    const steps = (Array.isArray(parsed.steps) ? parsed.steps : [])
      .filter(
        (s: any) =>
          (s?.family === "property" && (PROPERTY_OPS as Record<string, string>)[s?.op]) ||
          (s?.family === "design" && (DESIGN_OPS as Record<string, string>)[s?.op]),
      )
      .slice(0, 3)
      .map((s: any) => ({
        family: s.family as "property" | "design",
        op: String(s.op),
        label:
          s.family === "property"
            ? (PROPERTY_OPS as Record<string, string>)[s.op]!
            : (DESIGN_OPS as Record<string, string>)[s.op]!,
      }));
    return {
      steps,
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 240) : "",
      material: steps.some((s: any) => s.family === "design"),
    };
  });
