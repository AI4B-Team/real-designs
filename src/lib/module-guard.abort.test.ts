import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  reportModuleFailure,
  moduleFailures,
  isAbortLikeError,
  __resetModuleFailures,
} from "./module-guard";

describe("module guard ignores cancelled requests", () => {
  beforeEach(() => {
    __resetModuleFailures();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  it("treats aborted fetches as transient", () => {
    expect(isAbortLikeError(new TypeError("Failed to fetch"))).toBe(true);
    const err = new Error("cancelled");
    err.name = "AbortError";
    expect(isAbortLikeError(err)).toBe(true);
    expect(isAbortLikeError(new Error("boom"))).toBe(false);
  });

  it("does not record navigation aborts as failures", () => {
    reportModuleFailure("Workspace load", new TypeError("Failed to fetch"));
    expect(moduleFailures()).toHaveLength(0);
    reportModuleFailure("Workspace load", new Error("boom"));
    expect(moduleFailures()).toHaveLength(1);
  });
});
