import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Shop The Design object detection.
 *
 * The model looks at the ACTUAL design image and returns normalized boxes for
 * shoppable objects. There is no coordinate fallback: if the call fails or every
 * box lands under the confidence floor, the caller shows an honest empty state
 * and the user places objects by hand. A confident-looking wrong dot is worse
 * than no dot.
 */

const Input = z.object({
  image: z.string().min(16),
  roomType: z.string().max(60).default("Living Room"),
  categories: z.array(z.string().min(1).max(40)).min(1).max(60),
});

const CONFIDENCE_FLOOR = 0.45;
const MAX_OBJECTS = 10;

export const detectShopObjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const { charge, refund, chargeErrorMessage } = await import("@/lib/credits.server");
    const billing = await charge(context.userId, "design", "object scan");
    if (!billing.ok) throw new Error(chargeErrorMessage(billing));

    const allowed = data.categories;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You locate shoppable objects in an interior or exterior design image. " +
                "Return a normalized bounding box for each object you can actually see, in coordinates from 0 to 1 relative to the full image, where x and y are the top-left corner. " +
                "Use ONLY these labels, exactly as written: " +
                allowed.join(", ") +
                ". If an object does not fit one of those labels, omit it entirely. Never invent a category. " +
                "Only report an object you can clearly see; give an honest confidence between 0 and 1 and omit anything you are guessing at. " +
                "Boxes must tightly enclose the object as it appears in this specific photograph.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Room type: ${data.roomType}. Locate the shoppable objects in this image.` },
                { type: "image_url", image_url: { url: data.image } },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "report_objects",
                description: "Report the detected shoppable objects.",
                parameters: {
                  type: "object",
                  properties: {
                    objects: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          label: { type: "string" },
                          x: { type: "number" },
                          y: { type: "number" },
                          w: { type: "number" },
                          h: { type: "number" },
                          confidence: { type: "number" },
                        },
                        required: ["label", "x", "y", "w", "h", "confidence"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["objects"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "report_objects" } },
        }),
      });

      if (!res.ok) {
        await refund(context.userId, billing.charged, "object scan failed");
        if (res.status === 429) throw new Error("Rate limit reached, try again shortly.");
        if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
        throw new Error(`The object scan could not finish (${res.status}).`);
      }

      const payload = (await res.json()) as any;
      const call = payload?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!call) {
        await refund(context.userId, billing.charged, "object scan returned nothing");
        throw new Error("The object scan returned no result.");
      }

      let parsed: { objects?: unknown[] };
      try {
        parsed = JSON.parse(call);
      } catch {
        await refund(context.userId, billing.charged, "object scan unreadable");
        throw new Error("The object scan returned an unreadable result.");
      }

      const allowedSet = new Set(allowed.map((c) => c.toLowerCase()));
      const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : NaN);
      const clamp = (v: number) => Math.min(1, Math.max(0, v));

      const objects = (parsed.objects ?? [])
        .map((raw) => {
          const o = raw as Record<string, unknown>;
          const label = String(o["label"] ?? "").trim();
          const match = allowed.find((c) => c.toLowerCase() === label.toLowerCase());
          if (!match || !allowedSet.has(label.toLowerCase())) return null;
          const x = num(o["x"]);
          const y = num(o["y"]);
          const w = num(o["w"]);
          const h = num(o["h"]);
          const confidence = num(o["confidence"]);
          if ([x, y, w, h, confidence].some((v) => Number.isNaN(v))) return null;
          if (w <= 0.01 || h <= 0.01) return null;
          if (confidence < CONFIDENCE_FLOOR) return null;
          return {
            category: match,
            label: match,
            box: { x: clamp(x), y: clamp(y), w: Math.min(w, 1 - clamp(x)), h: Math.min(h, 1 - clamp(y)) },
            confidence: clamp(confidence),
          };
        })
        .filter(Boolean) as Array<{
        category: string;
        label: string;
        box: { x: number; y: number; w: number; h: number };
        confidence: number;
      }>;

      objects.sort((a, b) => b.confidence - a.confidence);

      return {
        objects: objects.slice(0, MAX_OBJECTS),
        balance: billing.balance,
        remainingToday: billing.remainingToday ?? null,
      };
    } catch (err) {
      throw err;
    }
  });
