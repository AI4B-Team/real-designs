import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Rewrites rough feedback into a concise request. Returns null when AI is unavailable. */
export const polishFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ body: z.string().min(3).max(4000), category: z.string().nullish() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { improveFeedback } = await import("@/lib/feedback.server");
    return { text: await improveFeedback(data.body, data.category ?? null) };
  });
