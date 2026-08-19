import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Budget availability.
 *
 * Pricing is only "available" once a market has been verified against real,
 * licensed contractor cost data (markets.verified_at) AND the unit cost
 * catalog has rows. Until then every budget surface says so plainly instead of
 * showing a fabricated number. Flipping this on is a data change, not a code
 * change: verify a market and the app starts pricing.
 */
export type BudgetAvailability = {
  available: boolean;
  markets: string[];
  headline: string;
  detail: string;
};

export const getBudgetAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<BudgetAvailability> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkBudgetsAvailable } = await import("@/lib/budget.server");

    const [{ data: markets }, available] = await Promise.all([
      supabaseAdmin.from("markets").select("name, verified_at").not("verified_at", "is", null),
      checkBudgetsAvailable(),
    ]);

    const names = ((markets as { name: string }[] | null) ?? []).map((m) => m.name);

    return {
      available,
      markets: names,
      headline: available ? "Budgets Are Live" : "Budgets Are Coming Soon",
      detail: available
        ? "Every budget is priced against verified local cost data."
        : "We Are Not Guessing At Renovation Costs. Budgets Turn On Once Verified Local Contractor Cost Data Is In Place For Your Market.",
    };
  });

/** Waitlist: tells us which markets to license cost data for first. */
export const requestBudgetMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        region: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(180).optional().nullable(),
        note: z.string().trim().max(600).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("market_requests").insert({
      user_id: context.userId,
      region: data.region,
      email:
        data.email || String((context.claims as Record<string, unknown>)["email"] ?? "") || null,
      note: data.note || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Whether this member already asked for their market. */
export const myBudgetRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("market_requests")
      .select("region, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    return { rows: data ?? [] };
  });
