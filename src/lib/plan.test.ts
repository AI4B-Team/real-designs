import { describe, expect, it } from "vitest";

import { normalizePlan, planAllows, planName, planRank, resolveSubscriptionPlan } from "./plan";

describe("plan resolver", () => {
  it("accepts every canonical tier", () => {
    for (const p of ["free", "starter", "pro", "studio"] as const) {
      expect(normalizePlan(p)).toBe(p);
      expect(resolveSubscriptionPlan(p)).toBe(p);
    }
  });

  it("treats blank, null and undefined as not loaded", () => {
    expect(normalizePlan("")).toBeNull();
    expect(normalizePlan("   ")).toBeNull();
    expect(normalizePlan(null)).toBeNull();
    expect(normalizePlan(undefined)).toBeNull();
  });

  it("falls back to free only when resolving entitlements", () => {
    expect(resolveSubscriptionPlan("")).toBe("free");
    expect(resolveSubscriptionPlan(null)).toBe("free");
    expect(resolveSubscriptionPlan(undefined)).toBe("free");
  });

  it("normalises casing and whitespace", () => {
    expect(normalizePlan("  PRO ")).toBe("pro");
    expect(normalizePlan("Studio")).toBe("studio");
  });

  it("maps legacy names", () => {
    expect(normalizePlan("basic")).toBe("starter");
    expect(normalizePlan("agency")).toBe("studio");
    expect(normalizePlan("nonsense")).toBeNull();
  });

  it("ranks and names plans", () => {
    expect(planRank("studio")).toBeGreaterThan(planRank("pro"));
    expect(planRank("")).toBe(0);
    expect(planName("")).toBe("Free");
    expect(planName("pro")).toBe("Pro");
  });

  it("gates features by required tier", () => {
    expect(planAllows("free", "")).toBe(true); // ungated tool
    expect(planAllows("free", null)).toBe(true);
    expect(planAllows("free", "pro")).toBe(false);
    expect(planAllows("pro", "pro")).toBe(true);
    expect(planAllows("studio", "pro")).toBe(true);
    expect(planAllows("pro", "studio")).toBe(false);
  });
});
