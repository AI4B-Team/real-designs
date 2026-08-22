/** @vitest-environment jsdom */
/**
 * Source-tab regressions: the listing-link source is gone for good, "Designs"
 * is folded into one Media picker, and generated designs keep their version
 * ids all the way into the handoff payload.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  mountSourcePicker,
  normalizeSource,
  CONTEXT_CONFIG,
  type PickerDesign,
} from "@/lib/source-picker";

const MEDIA: PickerDesign[] = [
  {
    id: "d1",
    path: "designs/d1.jpg",
    room: "Kitchen",
    style: "Warm Minimal",
    versionNo: 2,
    address: "123 Main St.",
    versionId: "v1",
    propertyId: "p1",
    assetId: "a1",
    roomId: "r1",
    assetType: "design",
    favorite: true,
  },
  {
    id: "photo-r1",
    path: "photos/r1.jpg",
    room: "Kitchen",
    address: "123 Main St.",
    propertyId: "p1",
    assetId: "a1",
    roomId: "r1",
    assetType: "photo",
  },
];

function mount(context: "design" | "video", onDesigns = vi.fn()) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  mountSourcePicker(host, {
    context,
    initialTab: "media",
    onFiles: async () => {},
    loadDesigns: async () => MEDIA,
    onDesigns,
  } as any);
  return { host, onDesigns };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const tabs = (host: HTMLElement) =>
  Array.from(host.querySelectorAll("[data-sp-tab]")).map((el) =>
    (el.textContent || "").toLowerCase(),
  );

describe("studio source tabs", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("never shows Listing Link for Design a Space", async () => {
    const { host } = mount("design");
    await tick();
    expect(tabs(host).some((t) => t.includes("listing"))).toBe(false);
    expect(host.textContent).not.toContain("Paste a listing link");
  });

  it("never shows Listing Link for Create a Video", async () => {
    const { host } = mount("video");
    await tick();
    expect(tabs(host).some((t) => t.includes("listing"))).toBe(false);
  });

  it("does not show Designs as its own source tab", async () => {
    const { host } = mount("video");
    await tick();
    expect(tabs(host).some((t) => t.trim() === "designs")).toBe(false);
  });

  it("shows Media in both workflows, in the shared source order", () => {
    expect(CONTEXT_CONFIG.design.sources).toEqual([
      "upload",
      "cloud",
      "property",
      "media",
      "describe",
    ]);
    expect(CONTEXT_CONFIG.video.sources).toEqual(CONTEXT_CONFIG.design.sources);
  });

  it("remaps removed sources instead of restoring them", () => {
    expect(normalizeSource("url")).toBe("upload");
    expect(normalizeSource("design")).toBe("media");
    expect(normalizeSource("media")).toBe("media");
  });

  it("filters generated designs and preserves version ids in the handoff", async () => {
    const { host, onDesigns } = mount("video");
    await tick();
    expect(host.querySelectorAll("[data-sp-design]").length).toBe(2);
    host.querySelector<HTMLElement>('[data-sp-mtype="designs"]')!.click();
    await tick();
    const cards = host.querySelectorAll("[data-sp-design]");
    expect(cards.length).toBe(1);
    (cards[0] as HTMLElement).click();
    await tick();
    host.querySelector<HTMLButtonElement>('[data-sp="dcontinue"]')!.click();
    await tick();
    const picked = onDesigns.mock.calls[0][0] as PickerDesign[];
    expect(picked.map((p) => p.versionId)).toEqual(["v1"]);
    expect(picked[0].assetId).toBe("a1");
    expect(picked[0].roomId).toBe("r1");
  });

  it("keeps selection order when several media items are chosen", async () => {
    const { host, onDesigns } = mount("video");
    await tick();
    host.querySelector<HTMLElement>('[data-sp-design="photo-r1"]')!.click();
    host.querySelector<HTMLElement>('[data-sp-design="d1"]')!.click();
    await tick();
    host.querySelector<HTMLButtonElement>('[data-sp="dcontinue"]')!.click();
    await tick();
    const picked = onDesigns.mock.calls[0][0] as PickerDesign[];
    expect(picked.map((p) => p.id)).toEqual(["photo-r1", "d1"]);
  });

  it("shows an actionable empty state instead of a blank panel", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountSourcePicker(host, {
      context: "video",
      initialTab: "media",
      onFiles: async () => {},
      loadDesigns: async () => [],
      onDesigns: vi.fn(),
    } as any);
    await tick();
    expect(host.textContent).toContain("No media yet");
    expect(host.querySelector('[data-sp="dupload"]')).toBeTruthy();
    expect(host.querySelector('[data-sp="dproperty"]')).toBeTruthy();
  });
});
