import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  tool: z.enum(["stage", "declutter", "materials", "sketch", "angle"]),
  image: z.string().min(16),
  room_type: z.string().max(60).default("living room"),
  direction: z.string().max(60).default("Warm Minimal"),
  style_id: z.string().max(80).nullable().optional(),
  grade: z.string().max(40).default("Retail Grade"),
  notes: z.string().max(600).nullable().optional(),
});

/** One-credit Studio room tools: stage, declutter, material swap, sketch, extra angle. */
export const runRoomTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const { buildToolPrompt, callImageModel, TOOL_LABEL } = await import("@/lib/room-tools.server");
    const { runGeneration } = await import("@/lib/generation-run.server");
    const { imageIdentity } = await import("@/lib/generation-identity");

    const label = TOOL_LABEL[data.tool];

    return runGeneration(
      {
        userId: context.userId,
        action: "design",
        kind: `room.${data.tool}`,
        note: label,
        requestId: data.request_id ?? null,
        parts: [
          imageIdentity(data.image),
          data.tool,
          data.room_type,
          data.direction,
          data.style_id,
          data.grade,
          data.notes,
        ],
      },
      async (job) => {
        const image = await callImageModel(buildToolPrompt(data), data.image, apiKey);
        return {
          image,
          label,
          balance: job.balance,
          remainingToday: job.remainingToday,
        };
      },
    );
  });
