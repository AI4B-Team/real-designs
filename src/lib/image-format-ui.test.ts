// @vitest-environment jsdom
/**
 * The Image Format control: one default, one card shape, one honest crop
 * affordance.
 */
import { describe, expect, it } from "vitest";
import { imageFormatSectionHtml, cropReviewLabel } from "@/lib/image-format-ui";
import { DEFAULT_OUTPUT_RATIO, normalizeOutputRatio } from "@/lib/output-ratio";

const mount = (html: string) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
};

const items = [
  { key: "a", label: "Kitchen · Photo 1", ratio: null, crop: null },
  { key: "b", label: "Kitchen · Photo 2", ratio: null, crop: null },
];

describe("image format cards", () => {
  it("defaults to Original and never to a fixed ratio", () => {
    expect(DEFAULT_OUTPUT_RATIO).toBe("original");
    expect(normalizeOutputRatio(undefined)).toBe("original");
    const el = mount(imageFormatSectionHtml({ value: undefined, items }));
    expect(el.querySelector(".rif-card.on")?.getAttribute("data-ratio")).toBe("original");
  });

  it("keeps a deliberately saved Square selection", () => {
    const el = mount(imageFormatSectionHtml({ value: "1:1", items }));
    expect(el.querySelector(".rif-card.on")?.getAttribute("data-ratio")).toBe("1:1");
  });

  it("gives every card the same structure and radio semantics", () => {
    const el = mount(imageFormatSectionHtml({ value: "original", items }));
    expect(el.querySelector(".rif-cards")?.getAttribute("role")).toBe("radiogroup");
    const cards = [...el.querySelectorAll(".rif-card")];
    expect(cards.length).toBe(5);
    for (const c of cards) {
      expect(c.querySelector(".rif-shape")).toBeTruthy();
      expect(c.querySelector(".rif-t b")).toBeTruthy();
      expect(c.querySelector(".rif-t em")).toBeTruthy();
      expect(c.querySelector(".rif-ck")).toBeTruthy();
      expect((c as HTMLElement).style.width).toBe("");
    }
    const on = el.querySelector(".rif-card.on")!;
    expect(on.getAttribute("aria-checked")).toBe("true");
    expect(on.querySelector(".rif-ck i")).toBeTruthy();
  });

  it("does not use the page overflow glyph for More Formats", () => {
    const el = mount(imageFormatSectionHtml({ value: "original", items }));
    const more = el.querySelector(".rif-more")!;
    expect(more.querySelector(".rif-shape i")?.getAttribute("data-lucide")).not.toBe("ellipsis");
    expect(more.textContent).toContain("More Formats");
  });

  it("hides crop review for Original and enables it for a fixed ratio", () => {
    expect(mount(imageFormatSectionHtml({ value: "original", items })).querySelector("[data-cropall]")).toBeNull();
    const fixed = mount(imageFormatSectionHtml({ value: "1:1", items, selected: 2 }));
    const btn = fixed.querySelector("[data-cropall]") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain("Review 2 Crop Positions");
  });

  it("pluralizes the crop review label", () => {
    expect(cropReviewLabel(1)).toBe("Review Crop Position");
    expect(cropReviewLabel(4)).toBe("Review 4 Crop Positions");
  });
});
