import { describe, it, expect, beforeEach } from "vitest";

import {
  beginNavigation,
  isCurrentNavigation,
  navSequence,
  navView,
  navHistory,
  retargetNavigation,
  __resetNav,
} from "./app-nav";
import {
  chunkSignature,
  shouldRecoverFromChunkError,
  clearChunkRecovery,
  type RecoveryStore,
} from "./chunk-recovery";

function memStore(): RecoveryStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe("navigation sequence", () => {
  beforeEach(() => __resetNav());

  it("only the newest navigation is current", () => {
    const studio = beginNavigation("studio", { reason: "sidebar_click" });
    expect(isCurrentNavigation(studio, "studio")).toBe(true);
    const media = beginNavigation("media", { reason: "sidebar_click" });
    // The startup/preference decision queued under Studio may no longer move us.
    expect(isCurrentNavigation(studio, "studio")).toBe(false);
    expect(isCurrentNavigation(media, "media")).toBe(true);
    expect(navView()).toBe("media");
  });

  it("rapid navigation leaves the last page active", () => {
    beginNavigation("studio");
    beginNavigation("media");
    const props = beginNavigation("props");
    expect(navView()).toBe("props");
    expect(isCurrentNavigation(props, "props")).toBe(true);
    expect(navSequence()).toBe(3);
  });

  it("a stale token cannot be revived by a retry loop", () => {
    const tok = beginNavigation("staging");
    beginNavigation("props");
    for (let i = 0; i < 5; i++) expect(isCurrentNavigation(tok, "staging")).toBe(false);
  });

  it("router retarget keeps the destination truthful without a new navigation", () => {
    const tok = beginNavigation("reveal");
    retargetNavigation("media");
    expect(navSequence()).toBe(tok);
    expect(isCurrentNavigation(tok, "media")).toBe(true);
    expect(isCurrentNavigation(tok, "reveal")).toBe(false);
  });

  it("logs route transitions without user content", () => {
    beginNavigation("studio", { reason: "sidebar_click", source: "rail" });
    const [entry] = navHistory();
    expect(entry?.to).toBe("studio");
    expect(entry?.reason).toBe("sidebar_click");
  });
});

describe("chunk recovery", () => {
  const build = "https://x/app-abc123.js";
  const err = "Failed to fetch dynamically imported module: https://x/chunk-1.js?t=1";

  it("allows exactly one reload per build and chunk", () => {
    const store = memStore();
    expect(shouldRecoverFromChunkError(err, store, build)).toBe(true);
    expect(shouldRecoverFromChunkError(err, store, build)).toBe(false);
    // even with a different cache-buster it is the same chunk
    expect(shouldRecoverFromChunkError(err.replace("t=1", "t=2"), store, build)).toBe(false);
  });

  it("allows recovery again on a new build", () => {
    const store = memStore();
    shouldRecoverFromChunkError(err, store, build);
    expect(shouldRecoverFromChunkError(err, store, "https://x/app-def456.js")).toBe(true);
  });

  it("never reloads when storage is unavailable", () => {
    expect(shouldRecoverFromChunkError(err, null, build)).toBe(false);
  });

  it("clears the guard once the app mounts", () => {
    const store = memStore();
    shouldRecoverFromChunkError(err, store, build);
    clearChunkRecovery(store);
    expect(shouldRecoverFromChunkError(err, store, build)).toBe(true);
  });

  it("normalizes signatures", () => {
    expect(chunkSignature(err)).toBe("https://x/chunk-1.js");
  });
});
