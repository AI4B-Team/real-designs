import { describe, expect, it } from "vitest";

import {
  GENERIC_STUDIO,
  STUDIO_HASH,
  canonicalHash,
  canvasCallbackIsCurrent,
  canvasSubtitle,
  isPhotoCanvas,
  isStudioRoute,
  mayGenericNavigate,
  needsNormalize,
  photoCanvasContext,
} from "./studio-context";

describe("routes", () => {
  it("treats the legacy hash as the canonical Studio route", () => {
    expect(canonicalHash("#studio")).toBe(STUDIO_HASH);
    expect(isStudioRoute("#studio")).toBe(true);
    expect(isStudioRoute("#v-studio")).toBe(true);
    expect(isStudioRoute("#v-media")).toBe(false);
  });
  it("only rewrites a non-canonical hash", () => {
    expect(needsNormalize("#studio")).toBe(true);
    expect(needsNormalize("#v-studio")).toBe(false);
    expect(needsNormalize("")).toBe(false);
  });
});

describe("studio context", () => {
  it("separates a canvas from a generic session", () => {
    expect(isPhotoCanvas(GENERIC_STUDIO)).toBe(false);
    expect(isPhotoCanvas(photoCanvasContext("d1", "p3"))).toBe(true);
  });
});

describe("canvas subtitle", () => {
  it("shows exactly one line per state", () => {
    expect(canvasSubtitle({ empty: true, result: false })).toBe("Add A Source To Begin");
    expect(canvasSubtitle({ empty: false, result: false })).toBe("Your source photo");
    expect(canvasSubtitle({ empty: false, result: false, phase: "generating" })).toContain(
      "Generating",
    );
    expect(canvasSubtitle({ empty: false, result: true })).toBe("Review your generated design");
    expect(canvasSubtitle({ empty: false, result: false, phase: "error" })).toContain("failed");
  });
});

describe("stale callbacks", () => {
  const ctx = photoCanvasContext("d1", "p3");
  it("never lets a delayed callback route away from a live canvas", () => {
    expect(mayGenericNavigate({ token: 4, current: 4, ctx })).toBe(false);
    expect(mayGenericNavigate({ token: 4, current: 4, ctx: GENERIC_STUDIO })).toBe(true);
    expect(mayGenericNavigate({ token: 3, current: 4, ctx: GENERIC_STUDIO })).toBe(false);
  });
  it("drops canvas work queued for another draft or photo", () => {
    expect(
      canvasCallbackIsCurrent({ token: 4, current: 4, ctx, draftId: "d1", photoKey: "p3" }),
    ).toBe(true);
    expect(
      canvasCallbackIsCurrent({ token: 4, current: 4, ctx, draftId: "d2", photoKey: "p3" }),
    ).toBe(false);
    expect(
      canvasCallbackIsCurrent({ token: 4, current: 4, ctx, draftId: "d1", photoKey: "p9" }),
    ).toBe(false);
    expect(
      canvasCallbackIsCurrent({ token: 4, current: 5, ctx, draftId: "d1", photoKey: "p3" }),
    ).toBe(false);
  });
});
