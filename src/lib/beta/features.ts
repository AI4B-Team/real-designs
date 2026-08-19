/**
 * Closed beta feature registry.
 *
 * One honest list of what REAL DESIGNS ships to beta testers and what is held
 * back. Pure and dependency free so the same registry decides server guards,
 * navigation labels and the Go/No-Go report.
 */

export type FeatureKey =
  | "auth"
  | "upload"
  | "room_classification"
  | "photo_design"
  | "canvas"
  | "video_builder"
  | "media"
  | "projects"
  | "presentations"
  | "share_links"
  | "budget"
  | "contractor_scope"
  | "listing_import"
  | "public_api"
  | "white_label"
  | "retailer_matching"
  | "billing"
  | "automated_email";

/** How a held-back feature behaves in the product. */
export type FeatureMode = "on" | "coming_soon" | "hidden";

export interface FeatureDef {
  key: FeatureKey;
  /** Title Case name shown in the UI. */
  name: string;
  /** In beta scope, i.e. genuinely working end to end. */
  inBeta: boolean;
  /** How it renders when it is not in beta. */
  offMode: Exclude<FeatureMode, "on">;
  /** Sidebar view id this feature owns, when it owns one. */
  view?: string;
  /** Honest one line reason, shown to testers. */
  reason?: string;
  /** Provider readiness this feature depends on. */
  requires?: "stripe" | "email";
}

export const FEATURES: FeatureDef[] = [
  { key: "auth", name: "Account Authentication", inBeta: true, offMode: "hidden" },
  { key: "upload", name: "Photo Upload", inBeta: true, offMode: "hidden" },
  { key: "room_classification", name: "Room Classification", inBeta: true, offMode: "hidden" },
  { key: "photo_design", name: "Photo Design", inBeta: true, offMode: "hidden", view: "studio" },
  { key: "canvas", name: "Canvas Editing", inBeta: true, offMode: "hidden" },
  { key: "video_builder", name: "Video Builder", inBeta: true, offMode: "hidden" },
  { key: "media", name: "Media", inBeta: true, offMode: "hidden", view: "media" },
  { key: "projects", name: "Saved Properties And Projects", inBeta: true, offMode: "hidden", view: "props" },
  { key: "presentations", name: "Presentations", inBeta: true, offMode: "hidden", view: "present" },
  { key: "share_links", name: "Share Links", inBeta: true, offMode: "hidden" },
  {
    key: "budget",
    name: "Budget",
    inBeta: false,
    offMode: "coming_soon",
    view: "scope",
    reason: "Budgets are not priced for your market yet, so we do not show numbers.",
  },
  {
    key: "contractor_scope",
    name: "Contractor Scope",
    inBeta: false,
    offMode: "coming_soon",
    reason: "Contractor-ready scope is paused until pricing is verified.",
  },
  {
    key: "listing_import",
    name: "Automated Listing Import",
    inBeta: false,
    offMode: "coming_soon",
    view: "listings",
    reason: "Automated listing import is not reliable enough for beta. Upload photos instead.",
  },
  {
    key: "public_api",
    name: "Public API",
    inBeta: false,
    offMode: "coming_soon",
    reason: "The public API is not open during the closed beta.",
  },
  {
    key: "white_label",
    name: "White Label",
    inBeta: false,
    offMode: "coming_soon",
    reason: "White label branding is incomplete.",
  },
  {
    key: "retailer_matching",
    name: "Retailer Product Matching",
    inBeta: false,
    offMode: "coming_soon",
    view: "products",
    reason: "Automatic retailer matching is off. You can still save your own products.",
  },
  {
    key: "billing",
    name: "Billing And Checkout",
    inBeta: false,
    offMode: "coming_soon",
    requires: "stripe",
    reason: "Checkout opens after the closed beta. Beta credits are granted manually.",
  },
  {
    key: "automated_email",
    name: "Automated Email",
    inBeta: false,
    offMode: "coming_soon",
    requires: "email",
    reason: "Transactional email is not connected yet, so we do not promise notifications.",
  },
];

export const FEATURE_MAP: Record<FeatureKey, FeatureDef> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f]),
) as Record<FeatureKey, FeatureDef>;

export interface BetaReadiness {
  /** Closed beta gating is active. */
  betaMode: boolean;
  /** The signed-in account is on the beta allowlist. */
  allowlisted: boolean;
  stripeReady?: boolean;
  emailReady?: boolean;
}

export interface FeatureState {
  key: FeatureKey;
  name: string;
  mode: FeatureMode;
  available: boolean;
  reason?: string;
  view?: string;
}

/**
 * Resolve every feature against beta mode and provider readiness. A feature is
 * only available when beta scope includes it AND its provider is ready.
 */
export function resolveFeatures(readiness: BetaReadiness): Record<FeatureKey, FeatureState> {
  const out = {} as Record<FeatureKey, FeatureState>;
  for (const f of FEATURES) {
    const providerReady =
      f.requires === "stripe"
        ? !!readiness.stripeReady
        : f.requires === "email"
          ? !!readiness.emailReady
          : true;
    // Outside beta mode a feature only needs its provider.
    const available = readiness.betaMode ? f.inBeta && providerReady : providerReady;
    const state: FeatureState = {
      key: f.key,
      name: f.name,
      mode: available ? "on" : f.offMode,
      available,
    };
    if (f.reason) state.reason = f.reason;
    if (f.view) state.view = f.view;
    out[f.key] = state;
  }
  return out;
}

/** Single yes/no used by both the server guards and the UI. */
export function featureAvailable(readiness: BetaReadiness, key: FeatureKey): boolean {
  return resolveFeatures(readiness)[key].available;
}

/** Copy shown when a tester reaches something that is not in the beta. */
export function unavailableMessage(key: FeatureKey): string {
  const def = FEATURE_MAP[key];
  if (!def) return "That feature is not available during the closed beta.";
  return `${def.name} Is Coming Soon. ${def.reason ?? "It is not part of the closed beta."}`;
}

/** Features a tester is expected to exercise, used by the beta checklist. */
export function betaScope(): FeatureDef[] {
  return FEATURES.filter((f) => f.inBeta);
}

/** Everything deliberately held back, used by the Go/No-Go report. */
export function betaHeldBack(): FeatureDef[] {
  return FEATURES.filter((f) => !f.inBeta);
}
