import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(resolve(process.cwd(), "src/styles", f), "utf8");

const tokens = read("rd-tokens.css");
const contracts = read("rd-contracts.css");
const app = read("rd-app.css");
const modal = read("rd-modal.css");

/**
 * Phase 2A guards. These do not assert how the product looks — they assert that
 * one token layer exists, that the legacy aliases resolve through it, and that
 * the layout contracts stay contracts (bounded, single-scroll-owner, no new
 * !important escapes).
 */
describe("foundational tokens", () => {
  const required = [
    // colors
    "--rd-color-brand",
    "--rd-color-brand-dark",
    "--rd-color-ink",
    "--rd-color-text-muted",
    "--rd-color-text-disabled",
    "--rd-color-bg",
    "--rd-color-surface",
    "--rd-color-surface-elevated",
    "--rd-color-border",
    "--rd-color-focus",
    "--rd-color-success",
    "--rd-color-warning",
    "--rd-color-error",
    // dimensions
    "--rd-size-sidebar",
    "--rd-size-sidebar-collapsed",
    "--rd-size-nav-icon",
    "--rd-size-nav-target",
    "--rd-size-tool-rail",
    "--rd-size-inspector",
    "--rd-size-header",
    "--rd-size-canvas-actionbar",
    "--rd-size-inspector-header",
    "--rd-size-inspector-footer-min",
    "--rd-size-modal-max",
    "--rd-size-card-radius",
    "--rd-size-control",
    // typography
    "--rd-font-sans",
    "--rd-font-mono",
    "--rd-text-h1",
    "--rd-text-body",
    "--rd-text-caption",
    "--rd-weight-bold",
    "--rd-leading-body",
    // effects
    "--rd-radius-md",
    "--rd-shadow-2",
    "--rd-focus-ring",
    "--rd-overlay-bg",
    "--rd-motion-base",
  ];

  it.each(required)("defines %s", (token) => {
    expect(tokens).toContain(`${token}:`);
  });

  it("declares the full spacing scale", () => {
    for (const step of [2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]) {
      expect(tokens).toContain(`--rd-space-${step}: ${step}px;`);
    }
  });

  it("honours reduced motion at the token layer", () => {
    expect(tokens).toContain("prefers-reduced-motion: reduce");
  });

  it("keeps the brand red unchanged", () => {
    expect(tokens).toContain("--rd-color-brand: #cc0000;");
    expect(tokens).toContain("--rd-color-brand-dark: #a30000;");
  });
});

describe("legacy aliases resolve through tokens", () => {
  it.each([
    ["--ink", "--rd-color-ink"],
    ["--line", "--rd-color-border"],
    ["--red", "--rd-color-brand"],
    ["--mute", "--rd-color-text-muted"],
    ["--sh", "--rd-shadow-2"],
  ])("maps %s to %s in the app root", (alias, token) => {
    expect(app).toContain(`${alias}: var(${token});`);
  });

  it("maps the modal root through the same tokens", () => {
    expect(modal).toContain("--red: var(--rd-color-brand);");
    expect(modal).toContain("--line: var(--rd-color-border);");
  });

  it("does not reintroduce a second palette of literals in the roots", () => {
    const appRoot = app.slice(app.indexOf(".rd-app {"), app.indexOf("}", app.indexOf(".rd-app {")));
    expect(appRoot).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
});

describe("layout contracts", () => {
  it("sizes both sidebar modes from tokens", () => {
    expect(contracts).toContain("grid-template-columns: var(--rd-size-sidebar) minmax(0, 1fr);");
    expect(contracts).toContain(
      "grid-template-columns: var(--rd-size-sidebar-collapsed) minmax(0, 1fr);",
    );
  });

  it("puts a 20px glyph inside a 44px collapsed target", () => {
    expect(tokens).toContain("--rd-size-nav-icon: 20px;");
    expect(tokens).toContain("--rd-size-nav-target: 44px;");
    expect(contracts).toContain("min-height: var(--rd-size-nav-target);");
    expect(contracts).toContain("flex: 0 0 var(--rd-size-nav-icon);");
  });

  it("gives the Canvas a flexible viewport row and a fixed action band", () => {
    expect(contracts).toContain("grid-template-rows: minmax(0, 1fr) auto;");
    expect(contracts).toContain("min-height: var(--rd-size-canvas-actionbar);");
  });

  it("gives the inspector one scroll owner between a fixed header and footer", () => {
    expect(contracts).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(contracts).toMatch(/\.rdw-panel-b \{[^}]*overflow-y: auto;/);
    expect(contracts).toMatch(/\.rdw-foot \{[^}]*position: static;/);
  });

  it("bounds modals in both dimensions", () => {
    expect(contracts).toContain("width: min(100%, var(--rd-size-modal-max));");
    expect(contracts).toContain("max-height: var(--rd-size-modal-max-h);");
  });

  it("keeps list thumbnails fixed and cropped", () => {
    expect(contracts).toContain("width: var(--rd-size-list-thumb-w);");
    expect(contracts).toContain("object-fit: cover;");
  });

  it("keeps accordion triggers at a 52px target", () => {
    expect(contracts.match(/min-height: 52px;/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("adds no !important escapes outside comments", () => {
    const declarations = contracts.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(declarations).not.toContain("!important");
  });

  it("only uses !important for the documented reduced-motion override", () => {
    const lines = tokens.split("\n").filter((l) => l.includes("!important"));
    expect(lines.every((l) => /animation|transition|scroll-behavior/.test(l))).toBe(true);
  });
});
