import { describe, expect, it } from "vitest";

import { durableStep, navigateTo, restoreStep, stepAvailability } from "./builder-step";

const keys = ["a", "b", "c"];

describe("durableStep", () => {
  it("is add with no photos", () => {
    expect(durableStep({ keys: [], activeKey: null })).toBe("add");
  });
  it("is rooms once photos exist", () => {
    expect(durableStep({ keys, activeKey: null })).toBe("rooms");
  });
  it("is design only for a photo that still exists", () => {
    expect(durableStep({ keys, activeKey: "b" })).toBe("design");
    expect(durableStep({ keys, activeKey: "zz" })).toBe("rooms");
  });
  it("never treats a falsy index-style key as open", () => {
    expect(durableStep({ keys, activeKey: "" })).toBe("rooms");
  });
  it("is review only when something was generated", () => {
    expect(durableStep({ keys, activeKey: null, reviewing: true })).toBe("rooms");
    expect(durableStep({ keys, activeKey: null, reviewing: true, completed: ["a"] })).toBe("review");
  });
});

describe("restoreStep", () => {
  it("returns to the canvas photo", () => {
    expect(restoreStep({ builder_step: "design", keys, activeKey: "c" })).toEqual({ step: "design", activeKey: "c" });
  });
  it("falls back to rooms when the photo is gone", () => {
    expect(restoreStep({ builder_step: "canvas", keys, activeKey: "gone" })).toEqual({ step: "rooms", activeKey: null });
  });
  it("falls back to add with no assets", () => {
    expect(restoreStep({ builder_step: "review", keys: [] }).step).toBe("add");
  });
  it("only restores review with results", () => {
    expect(restoreStep({ builder_step: "review", keys }).step).toBe("rooms");
    expect(restoreStep({ builder_step: "review", keys, completed: ["a"] }).step).toBe("review");
  });
});

describe("rail availability", () => {
  it("gates review behind a generated design", () => {
    expect(stepAvailability("review", { keys, activeKey: null }).ready).toBe(false);
    expect(stepAvailability("review", { keys, activeKey: null, completed: ["a"] }).ready).toBe(true);
  });
  it("design reopens the last room", () => {
    expect(navigateTo("design", { keys, activeKey: null, lastOpened: "b" })).toEqual({ step: "design", activeKey: "b" });
  });
  it("design without history asks for a room", () => {
    expect(navigateTo("design", { keys, activeKey: null }).prompt).toBe("choose-room");
  });
});
