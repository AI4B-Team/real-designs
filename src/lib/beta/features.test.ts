import { describe, it, expect } from "vitest";
import {
  resolveFeatures,
  featureAvailable,
  unavailableMessage,
  betaScope,
  betaHeldBack,
} from "./features";

const beta = { betaMode: true, allowlisted: true, stripeReady: false, emailReady: false };

describe("beta feature registry", () => {
  it("keeps the working workflows available in beta", () => {
    for (const key of [
      "auth",
      "upload",
      "room_classification",
      "photo_design",
      "canvas",
      "video_builder",
      "media",
      "projects",
      "presentations",
      "share_links",
    ] as const) {
      expect(featureAvailable(beta, key), key).toBe(true);
    }
  });

  it("holds back everything that is not ready", () => {
    for (const key of [
      "budget",
      "contractor_scope",
      "listing_import",
      "public_api",
      "white_label",
      "retailer_matching",
      "billing",
      "automated_email",
    ] as const) {
      expect(featureAvailable(beta, key), key).toBe(false);
    }
  });

  it("marks held-back features Coming Soon rather than silently missing", () => {
    expect(resolveFeatures(beta).budget.mode).toBe("coming_soon");
    expect(resolveFeatures(beta).budget.reason).toBeTruthy();
  });

  it("still requires provider readiness once beta mode is off", () => {
    const live = { betaMode: false, allowlisted: true, stripeReady: false, emailReady: true };
    expect(featureAvailable(live, "billing")).toBe(false);
    expect(featureAvailable(live, "automated_email")).toBe(true);
    expect(featureAvailable(live, "budget")).toBe(true);
  });

  it("opens billing when Stripe becomes ready and beta mode ends", () => {
    expect(
      featureAvailable({ betaMode: false, allowlisted: true, stripeReady: true }, "billing"),
    ).toBe(true);
  });

  it("explains unavailability honestly", () => {
    expect(unavailableMessage("public_api")).toContain("Public API");
    expect(unavailableMessage("public_api")).toContain("Coming Soon");
  });

  it("splits the registry into scope and held back with no overlap", () => {
    const scope = betaScope().map((f) => f.key);
    const held = betaHeldBack().map((f) => f.key);
    expect(scope.length).toBe(10);
    expect(held.length).toBe(8);
    expect(scope.some((k) => held.includes(k))).toBe(false);
  });
});
