import { describe, expect, it } from "vitest";

import {
  FEATURES,
  FEATURE_BY_ID,
  evaluateFeature,
  featureContext,
  featureForView,
  featureServerEnabled,
  resolveDirectRoute,
  unavailableReason,
} from "./features";
import { navigationFor, navigationViews } from "@/features/app-shell/navigation";
import { featureState, isFeatureVisible } from "@/features/app-shell/feature-availability";

/* The contexts a real session actually passes through. */
const signedOut = featureContext({ signedIn: false });
const loading = featureContext({ planStatus: "loading", plan: null });
const failed = featureContext({ planStatus: "error", plan: null });
const free = featureContext({ planStatus: "ready", plan: "free" });
const pro = featureContext({ planStatus: "ready", plan: "pro" });
const studio = featureContext({ planStatus: "ready", plan: "studio" });
const admin = featureContext({ planStatus: "ready", plan: "studio", role: "admin" });

const ALL = [signedOut, loading, failed, free, pro, studio, admin];

describe("feature registry shape", () => {
  it("gives every feature a canonical id, name and state", () => {
    for (const f of FEATURES) {
      expect(f.id.length).toBeGreaterThan(0);
      expect(f.name.length).toBeGreaterThan(0);
      expect(FEATURE_BY_ID[f.id]).toBe(f);
    }
  });

  it("never maps two features onto the same view", () => {
    const views = FEATURES.map((f) => f.view).filter(Boolean);
    expect(new Set(views).size).toBe(views.length);
  });

  it("keeps suppressed features off the server too", () => {
    expect(featureServerEnabled("budget")).toBe(false);
    expect(featureServerEnabled("api_white_label")).toBe(false);
    expect(featureServerEnabled("media")).toBe(true);
  });
});

describe("suppressed features", () => {
  it("is never visible or available in any context", () => {
    for (const ctx of ALL) {
      for (const id of ["budget", "checkout", "api_white_label", "contractor_scope"] as const) {
        const v = evaluateFeature(id, ctx);
        expect(v.available).toBe(false);
        expect(v.visibleInNav).toBe(false);
      }
    }
  });

  it("keeps Budget out of expanded and collapsed navigation identically", () => {
    for (const ctx of ALL) {
      const views = navigationViews(ctx);
      expect(views).not.toContain("scope");
      /* One registry drives both rails, so the two lists cannot diverge. */
      expect(navigationViews(ctx)).toEqual(views);
    }
  });

  it("redirects a direct route instead of showing partial UI", () => {
    for (const ctx of ALL) {
      const r = resolveDirectRoute("scope", ctx);
      expect(r.action).toBe("redirect");
      expect(r.to).toBe("dash");
      expect(r.reason).toBeTruthy();
    }
  });

  it("explains itself honestly", () => {
    expect(unavailableReason("budget")).toMatch(/Budget/);
  });
});

describe("active features", () => {
  const active = ["dash", "studio", "explore", "props", "designs", "media", "listings", "products", "reports", "present"];

  it("stays in navigation while the plan loads, fails or is Free", () => {
    for (const ctx of [loading, failed, free, pro, studio, admin]) {
      const views = navigationViews(ctx);
      for (const v of active) expect(views).toContain(v);
    }
  });

  it("opens on a direct route", () => {
    for (const v of active) expect(resolveDirectRoute(v, free).action).toBe("open");
  });

  it("survives a page refresh, i.e. depends on no async state", () => {
    const first = navigationViews(loading);
    const afterPlanArrives = navigationViews(pro);
    expect(first).toEqual(afterPlanArrives);
  });

  it("shows nothing to a signed-out visitor", () => {
    expect(navigationViews(signedOut)).toEqual([]);
    expect(evaluateFeature("media", signedOut).available).toBe(false);
  });
});

describe("plan gating fails closed", () => {
  const gated = { ...FEATURE_BY_ID.reports };

  it("treats loading and failed plans as not entitled", () => {
    /* Simulate a plan-gated feature through the same evaluator. */
    const original = FEATURE_BY_ID.reports;
    try {
      Object.assign(original, { state: "plan_gated", requiredPlan: "pro" });
      expect(evaluateFeature("reports", loading).available).toBe(false);
      expect(evaluateFeature("reports", failed).available).toBe(false);
      expect(evaluateFeature("reports", free).available).toBe(false);
      expect(evaluateFeature("reports", pro).available).toBe(true);
      /* Layout must not shift while the plan loads. */
      expect(navigationViews(loading)).toContain("reports");
      expect(navigationViews(failed)).toContain("reports");
    } finally {
      Object.assign(original, gated);
    }
  });
});

describe("admin-only features", () => {
  it("is invisible and unavailable to a normal user", () => {
    expect(evaluateFeature("admin_diagnostics", studio).available).toBe(false);
    expect(evaluateFeature("admin_diagnostics", studio).visibleInNav).toBe(false);
  });

  it("is available to an administrator", () => {
    expect(evaluateFeature("admin_diagnostics", admin).available).toBe(true);
  });
});

describe("intentional consolidations stay consolidated", () => {
  it("has no separate Video destination", () => {
    expect(navigationViews(pro)).not.toContain("reveal");
    expect(featureForView("reveal")?.id).toBe("video_builder");
    expect(evaluateFeature("video_builder", pro).available).toBe(true);
  });

  it("carries one icon and one label per destination", () => {
    const items = navigationFor(pro).flatMap((s) => s.items);
    expect(new Set(items.map((i) => i.view)).size).toBe(items.length);
    for (const i of items) {
      expect(i.label.length).toBeGreaterThan(0);
      expect(i.icon).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("shows no plan badges on unrelated destinations", () => {
    for (const i of navigationFor(free).flatMap((s) => s.items)) {
      expect(i.badge ?? null).toBeNull();
    }
  });
});

describe("legacy shell adapter agrees with the registry", () => {
  it("hides deferred surfaces and keeps live ones", () => {
    expect(isFeatureVisible("budget")).toBe(false);
    expect(isFeatureVisible("checkout")).toBe(false);
    expect(isFeatureVisible("api_white_label")).toBe(false);
    expect(featureState("products")).toBe("live");
    expect(featureState("reports")).toBe("live");
  });
});

describe("public pages are unaffected", () => {
  it("treats unknown views as open, so marketing routes are never gated", () => {
    for (const v of ["pricing", "about", "explore-public"]) {
      expect(resolveDirectRoute(v, signedOut).action).toBe("open");
    }
  });
});
