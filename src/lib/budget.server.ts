/**
 * Shared, server-only budget-availability check.
 *
 * Single source of truth used by every estimator/scope/budget handler so the
 * "no fabricated numbers" rule can never be bypassed by a code path that
 * forgot to check `getBudgetAvailability`. Pricing is available only once a
 * market is verified (markets.verified_at) AND the unit cost catalog has rows.
 */

export const BUDGET_UNAVAILABLE_MESSAGE =
  "Budgets Are Coming Soon — pricing turns on once verified local cost data is licensed for your market.";

export async function checkBudgetsAvailable(): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ count: verified }, { count: catalog }] = await Promise.all([
    supabaseAdmin.from("markets").select("id", { count: "exact", head: true }).not("verified_at", "is", null),
    supabaseAdmin.from("unit_costs").select("id", { count: "exact", head: true }),
  ]);
  return !!verified && !!catalog;
}

/** Throws before any credit deduction or model call when budgets aren't live yet. */
export async function assertBudgetsAvailable(): Promise<void> {
  const available = await checkBudgetsAvailable();
  if (!available) throw new Error(BUDGET_UNAVAILABLE_MESSAGE);
}
