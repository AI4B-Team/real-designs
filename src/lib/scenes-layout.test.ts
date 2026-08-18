/* Regression tests for the Property Video > Scenes workspace layout:
   the toolbar row (selection, address, actions) and the responsive column
   rules that must yield six complete cards on wide desktop widths. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/styles/rd-reveal.css"), "utf8");
const src = readFileSync(resolve(process.cwd(), "src/content/rd-reveal.ts"), "utf8");

describe("Scenes toolbar", () => {
  it("puts the address field inside the workspace toolbar row", () => {
    const bar = src.slice(src.indexOf(`<div class="rv-utility">`), src.indexOf(`<div class="rv-grid`));
    expect(bar).toContain("rvSelAll");
    expect(bar).toContain("of ${w.available.length} selected");
    expect(bar).toContain(`rv-utility-m`);
    expect(bar).toContain(`addressBarHtml(w, S.tree || [], "rvAddrBar")`);
    expect(bar).toContain("rvAuto");
    expect(bar).toContain("rv-more");
  });

  it("no longer renders the address field in the page header tools", () => {
    const head = src.slice(src.indexOf(`<div class="rv-head-tools">`), src.indexOf("rvHeadFile"));
    expect(head).not.toContain("addressBarHtml");
    expect(head).toContain("Video Format");
    expect(head).toContain("rvHeadAdd");
  });

  it("uses a single address input id so existing handlers stay wired", () => {
    expect(src.match(/addressBarHtml\(/g)?.length).toBe(1);
    expect(src).toContain(`el.querySelectorAll("#rvAddr, #rvAddrBar")`);
  });

  it("lets the address field wrap without shrinking to an unusable width", () => {
    expect(css).toMatch(/\.rv-utility-m \{[^}]*min-width: 220px/);
    expect(css).toMatch(/\.rv-utility-m \{[^}]*max-width: 520px/);
    expect(css).toMatch(/@media \(max-width: 900px\) \{\s*\.rd-app \.rv-utility-m \{ flex: 1 1 100%/);
  });
});

describe("Scenes grid columns", () => {
  it("uses six equal fractional columns on wide desktops", () => {
    expect(css).toMatch(/@media \(min-width: 1600px\) \{ \.rd-app \.rv-grid \{ grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  });

  it("falls back cleanly at narrower widths", () => {
    for (const [q, n] of [
      ["min-width: 1380px", 5],
      ["min-width: 1180px", 4],
      ["max-width: 900px", 3],
      ["max-width: 700px", 2],
    ] as const) {
      expect(css).toContain(`@media (${q}) { .rd-app .rv-grid { grid-template-columns: repeat(${n}, minmax(0, 1fr)); } }`);
    }
    expect(css).toContain("@media (max-width: 420px) { .rd-app .rv-grid { grid-template-columns: minmax(0, 1fr); } }");
  });

  it("keeps grid children shrinkable and images cover-fitted", () => {
    expect(css).toContain(".rd-app .rv-grid > * { min-width: 0; }");
    expect(css).toMatch(/\.rv-grid \.rv-tile-th img \{[^}]*object-fit: cover/);
    expect(css).not.toMatch(/\.rv-grid \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(200px/);
  });
});
