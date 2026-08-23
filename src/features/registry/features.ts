/**
 * One feature registry for REAL DESIGNS.
 *
 * Every question the shell used to answer in five different places — does this
 * belong in the sidebar, may a bookmarked hash open it, does a badge apply,
 * what do we tell someone who asks for it — is answered here, from static data,
 * before the first paint. Nothing in this module reads the network, so a
 * suppressed destination can never appear and then be taken away.
 *
 * This file describes policy only. It does not grant anything: server functions
 * keep their own authorization and entitlement checks, because client
 * visibility is not security.
 */

import type { PlanTier } from "@/lib/plan";
import { planAllows } from "@/lib/plan";

/** Availability states, from "ships today" to "was removed". */
export type AvailabilityState =
  /** Finished and usable by everyone the plan/role rules allow. */
  | "active"
  /** Usable, but still labelled as beta. */
  | "beta"
  /** Only an administrator may see or reach it. */
  | "admin_only"
  /** Built, but a higher plan is required to use it. */
  | "plan_gated"
  /** Unfinished: no entry point anywhere, and no partial UI on a direct route. */
  | "suppressed"
  /** Announced on purpose, with an honest explanation instead of the feature. */
  | "coming_soon"
  /** Existed once; kept only so old links resolve somewhere sensible. */
  | "retired";

export type AppRole = "user" | "admin";

/** What a direct link to an unavailable feature does. */
export type DirectRoute =
  /** The route renders normally. */
  | "open"
  /** The route sends the user to `redirectTo`, with no partial UI. */
  | "redirect"
  /** The route renders the safe "not available" explanation. */
  | "unavailable_page";

/** How a held-back feature explains itself when someone asks for it. */
export type ComingSoonBehavior = "none" | "explain" | "waitlist";

export type FeatureId =
  | "dashboard"
  | "studio"
  | "explore"
  | "properties"
  | "designs"
  | "media"
  | "video_builder"
  | "batch"
  | "products"
  | "reports"
  | "presentations"
  | "account"
  | "budget"
  | "contractor_scope"
  | "checkout"
  | "api_white_label"
  | "admin_diagnostics";

export interface FeatureDefinition {
  /** Canonical id. Stable across renames of the display name. */
  id: FeatureId;
  /** Title Case display name. */
  name: string;
  state: AvailabilityState;
  /** Minimum plan, or null when the plan does not matter. */
  requiredPlan: PlanTier | null;
  /** Required role, or null for any signed-in user. */
  requiredRole: AppRole | null;
  /** May a navigation destination be rendered for it. */
  nav: boolean;
  /** Legacy view key this feature owns (`#v-<view>`), when it owns one. */
  view: string | null;
  directRoute: DirectRoute;
  /** Destination for `directRoute: "redirect"`. */
  redirectTo: string | null;
  /** May the server perform this work at all. */
  server: boolean;
  /** Badge text, data driven — never duplicated in markup. */
  badge: string | null;
  comingSoon: ComingSoonBehavior;
  /** Honest one-line reason shown when it is unavailable. */
  reason: string | null;
}

type Draft = Partial<FeatureDefinition> & Pick<FeatureDefinition, "id" | "name" | "state">;

function def(d: Draft): FeatureDefinition {
  const suppressed = d.state === "suppressed" || d.state === "retired";
  return {
    requiredPlan: null,
    requiredRole: d.state === "admin_only" ? "admin" : null,
    nav: !suppressed,
    view: null,
    directRoute: suppressed ? "redirect" : "open",
    redirectTo: suppressed ? "dash" : null,
    server: d.state !== "suppressed" && d.state !== "retired",
    badge: d.state === "beta" ? "Beta" : null,
    comingSoon: d.state === "coming_soon" ? "explain" : "none",
    reason: null,
    ...d,
  };
}

export const FEATURES: FeatureDefinition[] = [
  def({ id: "dashboard", name: "Dashboard", state: "active", view: "dash" }),
  def({ id: "studio", name: "Studio", state: "active", view: "studio" }),
  def({ id: "explore", name: "Explore", state: "active", view: "explore" }),
  def({ id: "properties", name: "Properties", state: "active", view: "props" }),
  def({ id: "designs", name: "Designs", state: "active", view: "designs" }),
  def({ id: "media", name: "Media", state: "active", view: "media" }),
  /* Video was consolidated into Media on purpose. The capability ships; it has
     no navigation destination of its own and old links land on Media. */
  def({
    id: "video_builder",
    name: "Video Builder",
    state: "active",
    nav: false,
    view: "reveal",
    reason: "Video lives inside Media.",
  }),
  def({ id: "batch", name: "Batch", state: "active", view: "listings" }),
  def({ id: "products", name: "Products", state: "active", view: "products" }),
  def({ id: "reports", name: "Reports", state: "active", view: "reports" }),
  def({ id: "presentations", name: "Presentations", state: "active", view: "present" }),
  def({ id: "account", name: "Account", state: "active", nav: false, view: "account" }),

  /* Suppressed on purpose. Budget stays out of the shell until verified local
     cost data exists, because we will not show an invented number. */
  def({
    id: "budget",
    name: "Budget",
    state: "suppressed",
    view: "scope",
    redirectTo: "dash",
    comingSoon: "waitlist",
    reason: "Budgets turn on once verified local cost data is licensed for your market.",
  }),
  def({
    id: "contractor_scope",
    name: "Contractor Scope",
    state: "suppressed",
    reason: "Contractor-ready scope is paused until pricing is verified.",
  }),
  /* Checkout is deferred: no button may promise a payment flow that does not
     exist yet. */
  def({
    id: "checkout",
    name: "Checkout",
    state: "suppressed",
    reason: "Checkout opens after the closed beta.",
  }),
  def({
    id: "api_white_label",
    name: "API And White Label",
    state: "suppressed",
    reason: "The public API and white label branding are planned, not built.",
  }),
  def({
    id: "admin_diagnostics",
    name: "Storage Diagnostics",
    state: "admin_only",
    nav: false,
    reason: "Administrators only.",
  }),
];

export const FEATURE_BY_ID: Record<FeatureId, FeatureDefinition> = Object.fromEntries(
  FEATURES.map((f) => [f.id, f]),
) as Record<FeatureId, FeatureDefinition>;

const BY_VIEW = new Map<string, FeatureDefinition>(
  FEATURES.filter((f) => f.view).map((f) => [f.view as string, f]),
);

export function featureForView(view: string): FeatureDefinition | null {
  return BY_VIEW.get(String(view || "")) ?? null;
}

/** Everything the evaluation needs. Nothing here is trusted by the server. */
export interface FeatureContext {
  signedIn: boolean;
  /** Plan once known; null while it is loading or failed. */
  plan: PlanTier | null;
  /** Loading and error both mean "not proven", i.e. gated features fail closed. */
  planStatus: "loading" | "ready" | "error";
  role: AppRole;
}

export const DEFAULT_CONTEXT: FeatureContext = {
  signedIn: true,
  plan: null,
  planStatus: "loading",
  role: "user",
};

export function featureContext(partial: Partial<FeatureContext> = {}): FeatureContext {
  return { ...DEFAULT_CONTEXT, ...partial };
}

export interface FeatureVerdict {
  id: FeatureId;
  name: string;
  state: AvailabilityState;
  /** The feature may actually be used right now. */
  available: boolean;
  /** A navigation destination may be rendered for it. */
  visibleInNav: boolean;
  badge: string | null;
  reason: string | null;
  comingSoon: ComingSoonBehavior;
}

/**
 * Resolve one feature.
 *
 * Two rules do the work. Suppressed and retired features are invisible and
 * unusable, whatever the plan or role says. Plan-gated features stay visible so
 * the sidebar does not reflow while the subscription loads, but they are only
 * *usable* once a plan has actually been proven sufficient — loading and error
 * both fail closed.
 */
export function evaluateFeature(id: FeatureId, ctx: FeatureContext = DEFAULT_CONTEXT): FeatureVerdict {
  const f = FEATURE_BY_ID[id];
  if (!f) {
    return {
      id,
      name: String(id),
      state: "suppressed",
      available: false,
      visibleInNav: false,
      badge: null,
      reason: "Unknown feature.",
      comingSoon: "none",
    };
  }

  const base: FeatureVerdict = {
    id: f.id,
    name: f.name,
    state: f.state,
    available: false,
    visibleInNav: false,
    badge: f.badge,
    reason: f.reason,
    comingSoon: f.comingSoon,
  };

  if (f.state === "suppressed" || f.state === "retired" || f.state === "coming_soon") {
    return { ...base, visibleInNav: f.state === "coming_soon" ? f.nav : false };
  }

  if (!ctx.signedIn) return { ...base, visibleInNav: false };

  const roleOk = !f.requiredRole || ctx.role === f.requiredRole;
  if (!roleOk) return { ...base, visibleInNav: false };

  const planProven = ctx.planStatus === "ready";
  const planOk = !f.requiredPlan || (planProven && planAllows(ctx.plan, f.requiredPlan));

  return {
    ...base,
    available: planOk,
    /* A plan-gated destination keeps its place in the sidebar while the plan
       loads, so nothing shifts under the pointer; the gate is enforced when it
       is opened, and by the server on every call. */
    visibleInNav: f.nav,
  };
}

export interface RouteVerdict {
  action: "open" | "redirect" | "unavailable";
  /** View key to open instead, for `redirect`. */
  to: string | null;
  reason: string | null;
  feature: FeatureId | null;
}

/**
 * What a direct link to a view should do. Called by the router before any view
 * markup is revealed, so a suppressed feature cannot leak partial UI through a
 * bookmark, a typed hash or browser history.
 */
export function resolveDirectRoute(
  view: string,
  ctx: FeatureContext = DEFAULT_CONTEXT,
): RouteVerdict {
  const f = featureForView(view);
  if (!f) return { action: "open", to: null, reason: null, feature: null };

  const verdict = evaluateFeature(f.id, ctx);
  if (verdict.available) return { action: "open", to: null, reason: null, feature: f.id };

  if (f.directRoute === "redirect") {
    return {
      action: "redirect",
      to: f.redirectTo || "dash",
      reason: f.reason,
      feature: f.id,
    };
  }
  if (f.directRoute === "unavailable_page") {
    return { action: "unavailable", to: null, reason: f.reason, feature: f.id };
  }
  /* `open` features that are merely plan-gated or role-gated still open: the
     view itself shows the entitlement explanation, and the server refuses the
     work regardless. */
  return { action: "open", to: null, reason: verdict.reason, feature: f.id };
}

/** Copy for someone who reached something they cannot use. */
export function unavailableReason(id: FeatureId): string {
  const f = FEATURE_BY_ID[id];
  if (!f) return "That feature is not available.";
  return f.reason ? `${f.name} Is Not Available Yet. ${f.reason}` : `${f.name} Is Not Available Yet.`;
}

/** May the server run this feature's work at all (still authorize separately). */
export function featureServerEnabled(id: FeatureId): boolean {
  return !!FEATURE_BY_ID[id]?.server;
}
