// @vitest-environment jsdom
/**
 * The Add More Photos card is a simple fixed-shape "+" face card. Every source
 * lives in an anchored popover menu so nothing clips inside the card frame.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { addSourceCardHtml, mountAddSourceCard } from "@/lib/add-source-card";

function mount(opts: Parameters<typeof mountAddSourceCard>[1] = { onComputer: () => {} }) {
  document.body.innerHTML = addSourceCardHtml({ id: "addA" });
  const card = document.querySelector(".rv-addcard") as HTMLElement;
  mountAddSourceCard(card, opts);
  return card;
}

const face = (card: HTMLElement) => card.querySelector<HTMLElement>("[data-addface]")!;
const pop = () => document.querySelector<HTMLElement>(".rds-addpop");
const items = () =>
  Array.from(pop()?.querySelectorAll<HTMLElement>("[data-src]") || []).map((b) =>
    b.getAttribute("data-src"),
  );

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  document.querySelectorAll(".rds-addpop").forEach((p) => p.remove());
});

describe("Add More Photos card", () => {
  it("renders a single labelled face with a stable id", () => {
    const card = mount();
    expect(card.id).toBe("addA");
    expect(card.textContent).toContain("Add More Photos");
    expect(face(card).getAttribute("aria-expanded")).toBe("false");
    expect(pop()).toBeNull();
  });

  it("never mirrors the photo Image Format", () => {
    const card = mount();
    for (const c of ["rt-916", "rt-169", "rt-11", "rt-orig"]) {
      expect(card.classList.contains(c)).toBe(false);
    }
    expect(card.querySelector(".rv-room")).toBeNull();
  });

  it("opens a popover with computer and cloud sources by default", () => {
    const card = mount({ onComputer: () => {}, onCloud: () => {} });
    face(card).click();
    expect(items()).toEqual(["computer", "drive", "dropbox"]);
    expect(face(card).getAttribute("aria-expanded")).toBe("true");
  });

  it("lists every requested source when the host provides them", () => {
    const card = mount({
      onComputer: () => {},
      onCloud: () => {},
      onProperty: () => {},
      onMedia: () => {},
      sources: ["computer", "drive", "dropbox", "property", "media"],
    });
    face(card).click();
    expect(items()).toEqual(["computer", "drive", "dropbox", "property", "media"]);
  });

  it("hides sources with no handler", () => {
    const card = mount({ onComputer: () => {} });
    face(card).click();
    /* Only computer remains, so the menu is skipped entirely. */
    expect(pop()).toBeNull();
  });

  it("goes straight to the picker when computer is the only source", async () => {
    const onComputer = vi.fn();
    const card = mount({ onComputer });
    face(card).click();
    await Promise.resolve();
    expect(onComputer).toHaveBeenCalledTimes(1);
  });

  it("runs the chosen source once and closes the menu", async () => {
    const onComputer = vi.fn();
    const onCloud = vi.fn();
    const card = mount({ onComputer, onCloud });
    face(card).click();
    pop()!.querySelector<HTMLElement>('[data-src="dropbox"]')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onCloud).toHaveBeenCalledWith("dropbox");
    expect(onCloud).toHaveBeenCalledTimes(1);
    expect(onComputer).not.toHaveBeenCalled();
    expect(pop()).toBeNull();
    expect(face(card).getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps every menu item enabled and readable", () => {
    const card = mount({ onComputer: () => {}, onCloud: () => {} });
    face(card).click();
    for (const b of Array.from(pop()!.querySelectorAll<HTMLElement>("[data-src]"))) {
      expect(b.tagName).toBe("BUTTON");
      expect(b.getAttribute("type")).toBe("button");
      expect(b.hasAttribute("disabled")).toBe(false);
      expect(b.getAttribute("aria-disabled")).toBeNull();
      expect(b.textContent).not.toContain("Coming Soon");
    }
    expect(pop()!.textContent).toContain("Google Drive");
  });

  it("closes on Escape and on a second click of the face", () => {
    const card = mount({ onComputer: () => {}, onCloud: () => {} });
    face(card).click();
    expect(pop()).toBeTruthy();
    face(card).click();
    expect(pop()).toBeNull();
    face(card).click();
    pop()!
      .querySelector<HTMLElement>("[data-src]")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(pop()).toBeNull();
  });

  it("hands dropped files to the drop handler", async () => {
    const onDrop = vi.fn();
    const card = mount({ onComputer: () => {}, onDrop });
    const file = new File([new Uint8Array(4)], "a.jpg", { type: "image/jpeg" });
    const ev: any = new Event("drop", { bubbles: true });
    ev.dataTransfer = { files: [file] };
    card.dispatchEvent(ev);
    await Promise.resolve();
    expect(onDrop).toHaveBeenCalledTimes(1);
  });
});
