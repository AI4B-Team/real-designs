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
import { AppError } from "@/lib/errors/app-error";

export type CreditAction = "design" | "scope" | "plan_3d" | "video";

export const CREDIT_COSTS: Record<CreditAction, number> = {
  design: 1,
  scope: 3,
  plan_3d: 6,
  video: 40,
};

export type ChargeResult =
  | { ok: true; charged: number; balance: number; remainingToday?: number }
  | {
      ok: false;
      reason: "insufficient_credits" | "daily_limit" | "plan_required";
      cost: number;
      balance?: number;
    };

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
  if (error) {
    /* A charge that errors (as opposed to being refused) is an infrastructure
       failure: no credits were taken, and the caller must not treat it as a
       refusal the user can fix. */
    throw new AppError({
      code: "credit_charge_failed",
      category: "credits",
      severity: "critical",
      operation: "credits.charge",
      technicalMessage: error.message,
      userMessage:
        "We couldn't check your credits just now. Nothing was charged — try again in a moment.",
      retryable: true,
      context: { userId, action },
    });
  }
  return data as unknown as ChargeResult;
}

/** Give credits back when the metered work failed after being charged.
 *  A zero amount means the charge came out of the free daily allowance
 *  (free plan designs cost 0 credits), so restore that day's usage instead. */
export async function refund(userId: string, amount: number, note?: string): Promise<void> {
  if (amount < 0) return;
  if (amount === 0) {
    await supabaseAdmin.rpc("restore_free_design", {
      _user_id: userId,
      ...(note ? { _note: note } : {}),
    });
    return;
  }
  await supabaseAdmin.rpc("grant_credits", {
    _user_id: userId,
    _amount: amount,
    _action: "refund",
    ...(note ? { _note: note } : {}),
  });
}


export type CreditAccount = {
  user_id: string;
  plan: "free" | "starter" | "pro" | "studio";
  balance: number;
  free_used_today: number;
  free_day: string;
};

/** Transient upstream/network failures (connection reset, 111, fetch failed). */
function isTransient(message: string): boolean {
  return /upstream connect|connect error|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|502|503|504/i.test(
    message,
  );
}

export async function readAccount(userId: string): Promise<CreditAccount> {
  let lastMessage = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabaseAdmin
      .rpc("ensure_credit_account", { _user_id: userId })
      .then(
        (r) => r,
        (e: unknown) => ({ data: null, error: { message: String((e as Error)?.message ?? e) } }),
      );
    if (!error) return data as unknown as CreditAccount;
    lastMessage = error.message;
    if (!isTransient(lastMessage)) break;
    await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }
  throw new AppError({
    code: "credit_account_unavailable",
    category: "credits",
    severity: "high",
    operation: "credits.readAccount",
    technicalMessage: lastMessage,
    userMessage: "We couldn't load your credit balance. Nothing was charged — try again in a moment.",
    retryable: true,
    context: { userId },
  });
}
