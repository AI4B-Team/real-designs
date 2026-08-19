import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Room classification from the actual pixels of an uploaded photo.
 *
 * Organizing a photo set is not a billable generation, so nothing is charged
 * here. The model returns an honest confidence per image and the caller decides
 * what to trust; an unreadable or missing answer comes back as "Uncertain"
 * rather than a guess, so a failed call can never make the builder claim a
 * room is missing.
 */

const CATEGORIES = [
  "Front Exterior",
  "Rear Exterior",
  "Living Room",
  "Kitchen",
  "Dining Room",
  "Bedroom",
  "Bathroom",
  "Office",
  "Garage",
  "Pool",
  "Yard",
  "Entry",
  "Other Interior",
  "Other Exterior",
  "Uncertain",
] as const;

const Input = z.object({
  images: z
    .array(z.object({ id: z.string().min(1).max(80), image: z.string().min(16).max(4_000_000) }))
    .min(1)
    .max(8),
});

export type RoomGuess = { id: string; label: string; confidence: number };

export const classifyPhotoRooms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<{ results: RoomGuess[] }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const content: any[] = [
      {
        type: "text",
        text:
          "Classify each of the following real-estate photos. Photo ids in order: " +
          data.images.map((i) => i.id).join(", ") +
          ". Return one entry per photo, using the same id.",
      },
    ];
    for (const img of data.images)
      content.push({ type: "image_url", image_url: { url: img.image } });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You classify real-estate listing photos by what the image actually shows. " +
              "Use ONLY these labels, exactly as written: " +
              CATEGORIES.join(", ") +
              ". A photo of the street-facing front of a house is Front Exterior. " +
              "A room with sofas or seating around a television or fireplace is Living Room. " +
              "Give an honest confidence between 0 and 1 and use Uncertain with a low confidence when the image is ambiguous.",
          },
          { role: "user", content },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_rooms",
              description: "Report the room category of each photo.",
              parameters: {
                type: "object",
                properties: {
                  photos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        label: { type: "string", enum: CATEGORIES as unknown as string[] },
                        confidence: { type: "number" },
                      },
                      required: ["id", "label", "confidence"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["photos"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_rooms" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit reached, try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`Photo organization could not finish (${res.status}).`);
    }

    const payload = (await res.json()) as any;
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!call) throw new Error("Photo organization returned no result.");

    let parsed: { photos?: unknown[] };
    try {
      parsed = JSON.parse(call);
    } catch {
      throw new Error("Photo organization returned an unreadable result.");
    }

    const wanted = new Set(data.images.map((i) => i.id));
    const allowed = new Set(CATEGORIES.map((c) => c.toLowerCase()));
    const results: RoomGuess[] = [];
    for (const raw of parsed.photos ?? []) {
      const o = raw as Record<string, unknown>;
      const id = String(o["id"] ?? "");
      if (!wanted.has(id)) continue;
      const label = String(o["label"] ?? "").trim();
      if (!allowed.has(label.toLowerCase())) continue;
      const conf = Number(o["confidence"]);
      results.push({
        id,
        label: CATEGORIES.find((c) => c.toLowerCase() === label.toLowerCase())!,
        confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0,
      });
    }
    return { results };
  });
