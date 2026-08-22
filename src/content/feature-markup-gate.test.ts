import { describe, expect, it } from "vitest";

import { gateFeatureMarkup, removeElement } from "./feature-markup-gate";
import { overlaysHtml, viewsHtml } from "./rd-app-html";

describe("removeElement", () => {
  it("removes the element and all of its descendants", () => {
    const html = '<div><div id="x"><span><span>a</span></span></div><b>keep</b></div>';
    expect(removeElement(html, 'id="x"')).toBe("<div><b>keep</b></div>");
  });

  it("leaves markup untouched when the marker is absent", () => {
    const html = "<div><b>keep</b></div>";
    expect(removeElement(html, 'id="nope"')).toBe(html);
  });

  it("removes every occurrence of a marker", () => {
    const html = '<a data-goto="scope">1</a><a data-goto="scope">2</a><a>3</a>';
    expect(gateFeatureMarkup(html)).toBe("<a>3</a>");
  });
});

describe("gated app markup", () => {
  const views = gateFeatureMarkup(viewsHtml);
  const overlays = gateFeatureMarkup(overlaysHtml);

  it("never ships Budget markup to the DOM", () => {
    for (const marker of [
      'id="kpiBudget"',
      'id="budgetVsEstimateCard"',
      'id="toolrowBudget"',
      'id="v-scope"',
      'data-goto="scope"',
      'data-v="scope"',
    ]) {
      expect(views + overlays).not.toContain(marker);
    }
  });

  it("keeps the rest of the shell intact", () => {
    expect(views).toContain('id="v-dash"');
    expect(views).toContain('id="v-studio"');
    expect(views).toContain('data-tool="Redesign"');
  });
});
