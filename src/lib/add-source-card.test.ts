// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { addSourceCardHtml, mountAddSourceCard, isAddSourceCardOpen } from "@/lib/add-source-card";

function mount(opts: Parameters<typeof mountAddSourceCard>[1] = { onComputer: () => {} }) {
  document.body.innerHTML = addSourceCardHtml({ id: "addA" });
  const card = document.querySelector(".rv-addcard") as HTMLElement;
  mountAddSourceCard(card, opts);
  return card;
}

describe("Add More Photos card", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("starts collapsed with a single label and no overflowing sentence", () => {
    const card = mount();
    expect(card.textContent).toContain("Add More Photos");
    expect(card.textContent).not.toContain("Click To Choose A Source");
    expect(card.querySelector<HTMLElement>(".rv-addcard-src")!.hidden).toBe(true);
    expect(card.querySelector("[data-addface]")!.getAttribute("aria-expanded")).toBe("false");
  });

  it("offers only Computer, Google Drive and Dropbox", () => {
    const card = mount();
    const ids = Array.from(card.querySelectorAll("[data-addsrc]")).map((b) =>
      b.getAttribute("data-addsrc"),
    );
    expect(ids).toEqual(["computer", "drive", "dropbox"]);
  });

  it("expands in place on click and closes on Escape", () => {
    const card = mount();
    const face = card.querySelector<HTMLElement>("[data-addface]")!;
    face.click();
    expect(isAddSourceCardOpen(card)).toBe(true);
    expect(card.querySelector<HTMLElement>(".rv-addcard-src")!.hidden).toBe(false);
    card.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(isAddSourceCardOpen(card)).toBe(false);
  });

  it("runs the computer source and then collapses", async () => {
    const onComputer = vi.fn();
    const card = mount({ onComputer });
    card.querySelector<HTMLElement>("[data-addface]")!.click();
    card.querySelector<HTMLElement>('[data-addsrc="computer"]')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onComputer).toHaveBeenCalledTimes(1);
    expect(isAddSourceCardOpen(card)).toBe(false);
  });

  it("sends cloud choices to the import pipeline", async () => {
    const onCloud = vi.fn();
    const card = mount({ onComputer: () => {}, onCloud });
    card.querySelector<HTMLElement>('[data-addsrc="drive"]')!.click();
    await Promise.resolve();
    expect(onCloud).toHaveBeenCalledWith("drive");
  });

  it("does not render a separate popover or modal element", () => {
    mount();
    expect(document.querySelector(".rds-srcpop")).toBeNull();
    expect(document.querySelector(".rds-srcmodal")).toBeNull();
  });
});

describe("Add More Photos expanded controls", () => {
  it("offers a back control that returns to the collapsed card", () => {
    document.body.innerHTML = addSourceCardHtml({ id: "addB" });
    const card = document.querySelector(".rv-addcard") as HTMLElement;
    mountAddSourceCard(card, { onComputer: () => {} });
    card.querySelector<HTMLElement>("[data-addface]")!.click();
    expect(isAddSourceCardOpen(card)).toBe(true);
    const back = card.querySelector<HTMLElement>("[data-addback]")!;
    expect(back.getAttribute("aria-label")).toBe("Back To Add More Photos");
    back.click();
    expect(isAddSourceCardOpen(card)).toBe(false);
  });

  it("centres the icon and label as one group at every width", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/styles/rd-reveal.css", "utf8");
    const rule = css.split(".rd-app .rv-addsrc {")[1]!.split("}")[0]!;
    expect(rule).toContain("display: inline-flex");
    expect(rule).toContain("align-items: center");
    expect(rule).toContain("justify-content: center");
    expect(rule).toContain("gap: 10px");
    expect(rule).toContain("height: 44px");
    /* A fixed icon box means different logo widths never shift the label. */
    expect(css).toContain(".rd-app .rv-addsrc-i { display: inline-flex; width: 22px");
  });
});
