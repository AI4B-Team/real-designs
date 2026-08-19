import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Credit costs, mirrored from the database cost table for display only. */
export const CREDIT_COSTS = { design: 1, scope: 3, plan_3d: 6, video: 40 } as const;
export const FREE_DAILY_DESIGNS = 5;

/** Current balance, plan, and remaining free designs for the signed-in user. */
export const getMyCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readAccount } = await import("@/lib/credits.server");
    try {
      const acct = await readAccount(context.userId);
      return {
        plan: acct.plan,
        balance: acct.balance,
        remainingToday:
          acct.plan === "free" ? Math.max(FREE_DAILY_DESIGNS - acct.free_used_today, 0) : null,
        costs: CREDIT_COSTS,
        unavailable: false,
      };
    } catch {
      // Backend hiccup: degrade instead of crashing the page.
      return {
        plan: "free" as const,
        balance: 0,
        remainingToday: null,
        costs: CREDIT_COSTS,
        unavailable: true,
      };
    }
  });

/** Recent credit activity for the account page. */
export const listCreditHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("credit_ledger")
      .select("id, action, delta, balance_after, note, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });
