/**
 * Compatibility adapter over the one feature registry.
 *
 * The shell used to keep its own small availability table here. It now asks
 * `@/features/registry/features`, so navigation, direct routes, badges and the
 * server-side guards all read the same policy.
 */
import {
  DEFAULT_CONTEXT,
  evaluateFeature,
  type FeatureContext,
  type FeatureId,
} from "@/features/registry/features";

export type FeatureState =
  /** Fully usable today. */
  | "live"
  /** Not usable yet: no entry point anywhere in the shell. */
  | "hidden"
  /** Built, but the current plan or connection does not include it. */
  | "entitlement_required";

/** Legacy shell keys, mapped onto canonical feature ids. */
const ALIAS: Record<string, FeatureId> = {
  budget: "budget",
  batch: "batch",
  products: "products",
  reports: "reports",
  presentations: "presentations",
  media: "media",
  explore: "explore",
  checkout: "checkout",
  api_white_label: "api_white_label",
};

export type FeatureKey = keyof typeof ALIAS;

export function featureState(key: FeatureKey, ctx: FeatureContext = DEFAULT_CONTEXT): FeatureState {
  const id = ALIAS[key];
  if (!id) return "live";
  const verdict = evaluateFeature(id, ctx);
  if (verdict.state === "suppressed" || verdict.state === "retired") return "hidden";
  if (!verdict.available) return "entitlement_required";
  return "live";
}

/** True when the feature may render an entry point in the shell. */
export function isFeatureVisible(key: FeatureKey, ctx: FeatureContext = DEFAULT_CONTEXT): boolean {
  return featureState(key, ctx) !== "hidden";
}
