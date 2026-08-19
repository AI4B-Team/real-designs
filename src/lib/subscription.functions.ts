import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_TIERS, normalizePlan } from "@/lib/plan";

/**
 * Plan lifecycle.
 *
 * Checkout is not switched on yet, so an upgrade is recorded as a pending
 * request instead of activating itself. Downgrades and cancellations are
 * owned by the user and take effect straight away (cancellation runs to the
 * end of the paid term). Monthly credit refills are applied lazily whenever
 * the subscription is read.
 *
 * Every mutation runs through a security-definer routine that derives the
 * user from auth.uid(); no plan or user id is ever accepted from the client.
 */

/* Normalise first: whitespace/casing/legacy names must not reach the enum, and
   a blank value is rejected as a bug rather than parsed. */
const PlanEnum = z.preprocess((v) => normalizePlan(v) ?? v, z.enum(PLAN_TIERS));

export const MONTHLY_CREDITS: Record<string, number> = {
  free: 0,
  starter: 200,
  pro: 2000,
  studio: 4000,
};

export type Subscription = {
  plan: "free" | "starter" | "pro" | "studio";
  status: string;
  cancel_at_period_end: boolean;
  period_start: string | null;
  period_end: string | null;
  next_refill_on: string | null;
  monthly_credits: number;
  balance: number;
  pending_request: { id: string; plan: string; created_at: string } | null;
};

export const getSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("sync_subscription");
    if (error) throw new Error(error.message);
    return data as Subscription;
  });

export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ plan: PlanEnum }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as any).rpc("request_plan_change", {
      _plan: data.plan,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; pending?: boolean; plan?: string; reason?: string };
  });

export const setCancelAtPeriodEnd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ cancel: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as any).rpc("set_subscription_cancel", {
      _cancel: data.cancel,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; cancel_at_period_end?: boolean; reason?: string };
  });

export const withdrawPlanRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await (context.supabase as any).rpc("cancel_plan_request");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Subscription history for the Invoices pane: plan changes, refills, cancellations. */
export const listBillingEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("billing_events")
      .select("id, kind, detail, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as {
      id: string;
      kind: string;
      detail: string | null;
      meta: { amount?: number; plan?: string; credits?: number } | null;
      created_at: string;
    }[];
  });
