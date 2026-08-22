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

  it("keeps Google Drive and Dropbox clickable and never disabled", async () => {
    const onCloud = vi.fn();
    const card = mount({ onComputer: () => {}, onCloud });
    for (const id of ["drive", "dropbox"] as const) {
      const btn = card.querySelector<HTMLElement>(`[data-addsrc="${id}"]`)!;
      expect(btn.tagName).toBe("BUTTON");
      expect(btn.getAttribute("type")).toBe("button");
      expect(btn.hasAttribute("disabled")).toBe(false);
      expect(btn.getAttribute("aria-disabled")).toBeNull();
      btn.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(onCloud).toHaveBeenCalledWith(id);
    }
    expect(onCloud).toHaveBeenCalledTimes(2);
  });

  it("labels an unconfigured provider Coming Soon instead of fading it out", () => {
    const card = mount();
    const drive = card.querySelector<HTMLElement>('[data-addsrc="drive"]')!;
    expect(drive.textContent).toContain("Coming Soon");
  });

  it("has no X close icon and no invisible close hit area", () => {
    const card = mount();
    expect(card.querySelector("[data-addback]")).toBeNull();
    expect(card.querySelector('[data-lucide="x"]')).toBeNull();
    expect(card.querySelectorAll("button").length).toBe(4);
  });

  it("collapses only when the pointer leaves the whole card", () => {
    const card = mount();
    card.dispatchEvent(new Event("pointerenter"));
    expect(isAddSourceCardOpen(card)).toBe(true);
    const drive = card.querySelector<HTMLElement>('[data-addsrc="drive"]')!;
    const ev: any = new Event("pointerleave", { bubbles: false });
    ev.relatedTarget = drive;
    card.dispatchEvent(ev);
    expect(isAddSourceCardOpen(card)).toBe(true);
    const out: any = new Event("pointerleave", { bubbles: false });
    out.relatedTarget = document.body;
    card.dispatchEvent(out);
    expect(isAddSourceCardOpen(card)).toBe(false);
  });

  it("reveals and preserves the choices for keyboard focus", () => {
    const card = mount();
    card.querySelector<HTMLElement>('[data-addsrc="computer"]')!.dispatchEvent(
      new FocusEvent("focusin", { bubbles: true }),
    );
    expect(isAddSourceCardOpen(card)).toBe(true);
    const stay: any = new FocusEvent("focusout", { bubbles: true });
    Object.defineProperty(stay, "relatedTarget", {
      value: card.querySelector('[data-addsrc="dropbox"]'),
    });
    card.dispatchEvent(stay);
    expect(isAddSourceCardOpen(card)).toBe(true);
    const away: any = new FocusEvent("focusout", { bubbles: true });
    Object.defineProperty(away, "relatedTarget", { value: document.body });
    card.dispatchEvent(away);
    expect(isAddSourceCardOpen(card)).toBe(false);
  });

  it("taps open on touch and runs the chosen source once", async () => {
    const onComputer = vi.fn();
    const card = mount({ onComputer });
    card.dispatchEvent(new Event("pointerenter"));
    const btn = card.querySelector<HTMLElement>('[data-addsrc="computer"]')!;
    btn.click();
    btn.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onComputer).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(isAddSourceCardOpen(card)).toBe(false);
  });

  it("expands instantly on pointerenter with no timer", () => {
    const card = mount({ onComputer: () => {} });
    card.dispatchEvent(new Event("pointerenter", { bubbles: false }));
    expect(isAddSourceCardOpen(card)).toBe(true);
    expect(card.querySelector<HTMLElement>(".rv-addcard-src")!.hidden).toBe(false);
  });

  it("does not render a separate popover or modal element", () => {
    mount();
    expect(document.querySelector(".rds-srcpop")).toBeNull();
    expect(document.querySelector(".rds-srcmodal")).toBeNull();
  });
});

describe("Add More Photos expanded controls", () => {
  it("closes from the face control without any X icon", () => {
    document.body.innerHTML = addSourceCardHtml({ id: "addB" });
    const card = document.querySelector(".rv-addcard") as HTMLElement;
    mountAddSourceCard(card, { onComputer: () => {} });
    const face = card.querySelector<HTMLElement>("[data-addface]")!;
    face.click();
    expect(isAddSourceCardOpen(card)).toBe(true);
    face.click();
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
