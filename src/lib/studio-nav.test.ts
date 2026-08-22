import { describe, expect, it } from "vitest";
import { decideStudioNav, navigateToStudio, type StudioNavEnv } from "./studio-nav";

function env(canvasActive: boolean, token = 1): StudioNavEnv & { views: string[] } {
  const views: string[] = [];
  return { canvasActive: () => canvasActive, token: () => token, go: (v) => views.push(v), views };
}

describe("studio navigation contract", () => {
  it("navigates freely when no Canvas is open", () => {
    const e = env(false);
    expect(navigateToStudio({ reason: "recovery" }, e).navigated).toBe(true);
    expect(e.views).toEqual(["studio"]);
  });

  it("keeps a live Canvas mounted when the user did not ask", () => {
    const e = env(true);
    const d = navigateToStudio({ reason: "recovery" }, e);
    expect(d.navigated).toBe(false);
    expect(d.blocked).toBe("not-user-initiated");
    expect(e.views).toEqual([]);
  });

  it("allows an explicit user exit", () => {
    const e = env(true);
    expect(navigateToStudio({ reason: "user", initiatedByUser: true }, e).navigated).toBe(true);
  });

  it("allows a completed workflow with a known destination", () => {
    expect(decideStudioNav({ reason: "workflow-complete" }, env(true)).navigated).toBe(true);
  });

  it("ignores a callback from an older route even when user initiated", () => {
    const d = decideStudioNav({ reason: "user", initiatedByUser: true, token: 0 }, env(true, 3));
    expect(d.navigated).toBe(false);
    expect(d.blocked).toBe("stale-callback");
  });

  it("a failed fetch during a long session never redirects", () => {
    const e = env(true);
    for (let i = 0; i < 20; i++) navigateToStudio({ reason: "recovery" }, e);
    expect(e.views).toEqual([]);
  });

  it("a stale handoff cannot steal an open Canvas", () => {
    expect(decideStudioNav({ reason: "handoff" }, env(true)).navigated).toBe(false);
    expect(decideStudioNav({ reason: "startup" }, env(true)).navigated).toBe(false);
  });
});
