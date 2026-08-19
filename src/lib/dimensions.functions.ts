import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Phase 3 — dimension estimation.
 *
 * The model PROPOSES room dimensions from a photo. It never confirms them and it
 * never sees a price. A human confirms the numbers (confirmRoomDimensions), and only
 * then do the quantity formulas in the SQL estimator treat them as trustworthy.
 */

const Input = z.object({
  image: z.string().min(16), // data URL or absolute https URL
  room_type: z.string().default("living room"),
  hint: z.string().max(300).nullable().optional(),
});

const Proposal = z.object({
  floor_area_sf: z.number().positive().max(5000),
  ceiling_ht_in: z.number().positive().max(240),
  perimeter_lf: z.number().positive().max(600),
  confidence: z.enum(["low", "medium", "high"]),
  basis: z.string(),
});

export const estimateDimensions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You estimate the physical dimensions of a room from a single photograph. " +
              "Scale the space using known reference objects in the frame (standard door 80in tall, outlet 15in above floor, " +
              "counter 36in, sofa seat 17in, floor plank widths, switch plates). " +
              "Never mention or imply cost. Report a proposal only: a human will confirm or correct it. " +
              "Set confidence low when the frame shows less than two walls or has no reliable reference object.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `Room type: ${data.room_type}.` +
                  (data.hint ? ` Known information: ${data.hint}.` : "") +
                  " Estimate the floor area in square feet, ceiling height in inches, and floor perimeter in linear feet.",
              },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_dimensions",
              description: "Report the proposed room dimensions.",
              parameters: {
                type: "object",
                properties: {
                  floor_area_sf: { type: "number" },
                  ceiling_ht_in: { type: "number" },
                  perimeter_lf: { type: "number" },
                  confidence: { type: "string", enum: ["low", "medium", "high"] },
                  basis: {
                    type: "string",
                    description:
                      "One sentence naming the reference objects used to scale the room.",
                  },
                },
                required: ["floor_area_sf", "ceiling_ht_in", "perimeter_lf", "confidence", "basis"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_dimensions" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached, try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    if (!res.ok) throw new Error(`Dimension estimate failed (${res.status}).`);

    const payload = (await res.json()) as any;
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!call) throw new Error("No dimensions were returned.");

    let raw: unknown;
    try {
      raw = JSON.parse(call);
    } catch {
      throw new Error("The dimension estimate was unreadable.");
    }

    const parsed = Proposal.safeParse(raw);
    if (!parsed.success) throw new Error("The dimension estimate was out of a believable range.");

    const p = parsed.data;
    // Wall area is derived, never guessed by the model: perimeter x ceiling height,
    // less a conventional 12% for openings.
    const wall = p.perimeter_lf * (p.ceiling_ht_in / 12) * 0.88;

    return {
      floor_area_sf: Math.round(p.floor_area_sf),
      wall_area_sf: Math.round(wall),
      ceiling_ht_in: Math.round(p.ceiling_ht_in),
      perimeter_lf: Math.round(p.perimeter_lf),
      confidence: p.confidence,
      basis: p.basis,
      dims_source: "depth_estimate" as const,
      // Nothing downstream may treat these as confirmed until a person says so.
      confirmed: false,
      disclaimer:
        "Proposed from one photo. Confirm or correct these before the estimate is used for planning.",
    };
  });
