/**
 * One static registry describing what the shell is allowed to advertise.
 *
 * The rule the product asked for: a feature that cannot do real work today
 * never appears in navigation, search, menus or dashboards — and it is never
 * decided by how much data a workspace happens to have. Availability is a
 * policy, not a count, so it is known at first paint and there is no flash of
 * a control that then disappears.
 */
export type FeatureState =
  /** Fully usable today. */
  | "live"
  /** Not usable yet: no entry point anywhere in the shell. */
  | "hidden"
  /** Built, but the current plan or connection does not include it. */
  | "entitlement_required";

export type FeatureKey =
  | "budget"
  | "batch"
  | "products"
  | "reports"
  | "presentations"
  | "media"
  | "explore"
  | "checkout"
  | "api_white_label";

const REGISTRY: Record<FeatureKey, FeatureState> = {
  budget: "hidden",
  api_white_label: "hidden",
  /* Checkout is intentionally deferred: no plan upgrade button may promise a
     payment flow that does not exist yet. */
  checkout: "hidden",
  batch: "live",
  products: "live",
  reports: "live",
  presentations: "live",
  media: "live",
  explore: "live",
};

export function featureState(key: FeatureKey): FeatureState {
  return REGISTRY[key] ?? "live";
}

/** True when the feature may render an entry point in the shell. */
export function isFeatureVisible(key: FeatureKey): boolean {
  return featureState(key) !== "hidden";
}
