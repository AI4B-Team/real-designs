/**
 * One canonical place to read, normalise and rank a subscription plan.
 *
 * Historical rows can hold "", null, "Pro " or a legacy name. None of those may
 * ever reach the plan enum on the server, so everything funnels through
 * normalizePlan() first and unresolved values stay `null` — never `""`.
 */

export const PLAN_TIERS = ["free", "starter", "pro", "studio"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const PLAN_NAMES: Record<PlanTier, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  studio: "Studio",
};

export const PLAN_RANKS: Record<PlanTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  studio: 3,
};

/** Older names that mapped onto today's tiers. */
const LEGACY: Record<string, PlanTier> = {
  basic: "starter",
  plus: "pro",
  premium: "pro",
  agency: "studio",
  team: "studio",
  business: "studio",
};

/** Returns a valid tier, or null when the value is blank/unknown ("not loaded"). */
export function normalizePlan(value: unknown): PlanTier | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if ((PLAN_TIERS as readonly string[]).includes(v)) return v as PlanTier;
  return LEGACY[v] ?? null;
}

/** The documented product default for a signed-in account with no saved plan. */
export const DEFAULT_PLAN: PlanTier = "free";

/** Normalised plan with the Free fallback applied — for entitlement checks only. */
export function resolveSubscriptionPlan(value: unknown): PlanTier {
  return normalizePlan(value) ?? DEFAULT_PLAN;
}

export function planRank(value: unknown): number {
  return PLAN_RANKS[resolveSubscriptionPlan(value)];
}

export function planName(value: unknown): string {
  const p = normalizePlan(value);
  return p ? PLAN_NAMES[p] : "Free";
}

/** True when `current` is entitled to something that requires `required`. */
export function planAllows(current: unknown, required: unknown): boolean {
  const need = normalizePlan(required);
  if (!need) return true; // no requirement recorded: the feature is not gated
  return planRank(current) >= PLAN_RANKS[need];
}
