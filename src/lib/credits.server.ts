/**
 * Credit metering. Server-only.
 *
 * Costs live in the database (public.credit_cost) so the UI and the charge
 * path can never drift. Every paid action calls charge() BEFORE doing the
 * work, and refund() if the work then fails.
 *
 * Free plan does not consume balance: it gets 5 designs per day and nothing
 * else. That rule is enforced inside spend_credits, not here.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CreditAction = "design" | "scope" | "plan_3d" | "video";

export const CREDIT_COSTS: Record<CreditAction, number> = {
  design: 1,
  scope: 3,
  plan_3d: 6,
  video: 40,
};

export type ChargeResult =
  | { ok: true; charged: number; balance: number; remainingToday?: number }
  | { ok: false; reason: "insufficient_credits" | "daily_limit" | "plan_required"; cost: number; balance?: number };

/** Human wording for a refusal, safe to surface in the UI. */
export function chargeErrorMessage(result: Extract<ChargeResult, { ok: false }>): string {
  switch (result.reason) {
    case "daily_limit":
      return "You've used all 5 free designs for today. They reset tomorrow, or upgrade for a credit balance.";
    case "plan_required":
      return "This action needs a paid plan. The free plan covers 5 designs a day.";
    default:
      return `Not enough credits. This costs ${result.cost} and you have ${result.balance ?? 0}.`;
  }
}

export async function charge(
  userId: string,
  action: CreditAction,
  note?: string,
): Promise<ChargeResult> {
  const { data, error } = await supabaseAdmin.rpc("spend_credits", {
    _user_id: userId,
    _action: action,
    ...(note ? { _note: note } : {}),
  });
  if (error) throw new Error(`Credit charge failed: ${error.message}`);
  return data as unknown as ChargeResult;
}

/** Give credits back when the metered work failed after being charged. */
export async function refund(userId: string, amount: number, note?: string): Promise<void> {
  if (amount <= 0) return;
  await supabaseAdmin.rpc("grant_credits", {
    _user_id: userId,
    _amount: amount,
    _action: "refund",
    ...(note ? { _note: note } : {}),
  });
}

export async function readAccount(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("ensure_credit_account", { _user_id: userId });
  if (error) throw new Error(error.message);
  return data as unknown as {
    user_id: string;
    plan: "free" | "starter" | "pro" | "studio";
    balance: number;
    free_used_today: number;
    free_day: string;
  };
}
