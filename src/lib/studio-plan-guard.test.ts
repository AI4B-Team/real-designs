import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { html as APP_HTML } from "@/content/rd-app-html";
import { normalizePlan, planAllows } from "@/lib/plan";

/**
 * Regression guards for the billing/Studio attribute collision: Studio tool
 * rows once used data-plan, so selecting a tool posted an empty plan into the
 * subscription enum and surfaced a raw Zod object in a browser alert.
 */

const html = String(APP_HTML);
const script = readFileSync(resolve(process.cwd(), "src/content/rd-app-script.ts"), "utf8");

const toolRows = Array.from(html.matchAll(/data-tool="([^"]+)"([^>]*)/g)).map((m) => ({
  name: m[1],
  attrs: m[2],
}));

const UNRESTRICTED = ["Redesign", "Virtual Stage", "Declutter", "Material Swap"];
const RESTRICTED: Record<string, string> = {
  "Sketch To Render": "pro",
  "Multi Angle": "studio",
  "Walkthrough Video": "studio",
  "2D To 3D Plan": "studio",
};

describe("studio tool access attributes", () => {
  it("keeps every Studio tool in the markup", () => {
    const names = toolRows.map((t) => t.name);
    for (const n of [...UNRESTRICTED, ...Object.keys(RESTRICTED)]) {
      expect(names).toContain(n);
    }
  });

  it("never uses data-plan on a Studio tool row", () => {
    for (const t of toolRows) expect(t.attrs).not.toContain("data-plan");
  });

  it("omits the attribute entirely for unrestricted tools", () => {
    for (const name of UNRESTRICTED) {
      const row = toolRows.find((t) => t.name === name)!;
      expect(row.attrs).not.toContain("data-required-plan");
    }
  });

  it("declares the required tier for restricted tools", () => {
    for (const [name, tier] of Object.entries(RESTRICTED)) {
      const row = toolRows.find((t) => t.name === name)!;
      expect(row.attrs).toContain('data-required-plan="' + tier + '"');
    }
  });

  it("keeps Budget disabled as a Coming Soon tool", () => {
    const row = toolRows.find((t) => t.name === "Budget")!;
    expect(row.attrs).toContain('aria-disabled="true"');
    expect(row.attrs).not.toContain("data-required-plan");
  });

  it("never emits an empty required plan", () => {
    expect(html).not.toContain('data-required-plan=""');
    expect(html).not.toContain('data-plan=""');
  });
});

describe("billing mutation surface", () => {
  it("scopes plan clicks to the Billing panel", () => {
    expect(script).toContain('"#p-billing [data-plan]');
    expect(script).not.toContain('"#planRows [data-plan]');
    expect(script).not.toMatch(/closest\(\s*"\[data-plan\]/);
  });

  it("validates the plan before calling changePlan", () => {
    const call = script.indexOf("await changePlan(");
    expect(call).toBeGreaterThan(0);
    const guard = script.lastIndexOf('normalizePlan(t.getAttribute("data-plan"))', call);
    expect(guard).toBeGreaterThan(0);
    expect(script.slice(guard, call)).toContain("if (!plan)");
  });

  it("rejects blank and unknown outgoing plans", () => {
    for (const bad of ["", "   ", "enterprise", null, undefined]) {
      expect(normalizePlan(bad)).toBeNull();
    }
  });

  it("treats a missing subscription as free without unlocking paid tools", () => {
    expect(planAllows(undefined, "pro")).toBe(false);
    expect(planAllows(null, "studio")).toBe(false);
    expect(planAllows("free", undefined)).toBe(true);
  });
});

describe("studio error surfaces", () => {
  it("uses branded messaging instead of native alerts", () => {
    expect(script).not.toMatch(/(^|[^.\w])alert\(/m);
  });

  it("keeps an explicit retry path when a render cannot be saved", () => {
    expect(html).toContain('id="studioRetrySave"');
    expect(html).toContain("Your design was generated but could not be saved.");
    expect(script).toContain("async function persistRender(");
    expect(script).toContain("async function retryPendingSave(");
    // The retry re-uploads the stored image; it never re-runs generation.
    const retry = script.slice(
      script.indexOf("async function retryPendingSave("),
      script.indexOf("function addRenderVariant("),
    );
    expect(retry).toContain("persistRender(image, label)");
    expect(retry).not.toContain("spend");
    expect(script).not.toContain("catch (e0) {\n          lastRenderPath = null;");
  });
});
