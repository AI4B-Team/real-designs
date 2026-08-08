import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const FOUNDING_LIMIT = 500;

/** Claim a founding seat. The 500 cap is enforced by the insert policy in the database. */
export const claimFoundingSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ plan: z.enum(["starter", "pro", "studio"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("founding_members")
      .select("id, plan, claimed_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { claimed: true, seat: existing, alreadyHeld: true };

    const { data: seat, error } = await supabase
      .from("founding_members")
      .insert({ user_id: userId, plan: data.plan })
      .select("id, plan, claimed_at")
      .maybeSingle();

    // A policy violation here means the 500 seats are genuinely gone.
    if (error || !seat) return { claimed: false, seat: null, alreadyHeld: false };
    return { claimed: true, seat, alreadyHeld: false };
  });

/** Does the caller hold a founding rate? Founding rates persist through plan changes. */
export const getMyFoundingSeat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("founding_members")
      .select("id, plan, claimed_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data ?? null;
  });
