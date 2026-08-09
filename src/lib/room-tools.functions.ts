import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  tool: z.enum(["stage", "declutter", "materials", "sketch", "angle"]),
  image: z.string().min(16),
  room_type: z.string().max(60).default("living room"),
  direction: z.string().max(60).default("Warm Minimal"),
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
    const { charge, refund, chargeErrorMessage } = await import("@/lib/credits.server");

    const label = TOOL_LABEL[data.tool];
    const charged = await charge(context.userId, "design", label);
    if (!charged.ok) throw new Error(chargeErrorMessage(charged));

    try {
      const image = await callImageModel(buildToolPrompt(data), data.image, apiKey);
      return { image, label, balance: charged.balance, remainingToday: charged.remainingToday ?? null };
    } catch (err) {
      await refund(context.userId, charged.charged, `${label} failed`);
      throw err;
    }
  });
