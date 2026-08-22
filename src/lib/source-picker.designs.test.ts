/** @vitest-environment jsdom */
/**
 * The video "Select designs" picker: selection, ordering and the handoff
 * payload are the parts that silently break the Video Builder, so they get
 * direct DOM coverage.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountSourcePicker, type PickerDesign } from "@/lib/source-picker";

const DESIGNS: PickerDesign[] = [
  {
    id: "a",
    path: "designs/a.jpg",
    room: "Kitchen",
    style: "Warm Minimal",
    versionNo: 2,
    status: "draft",
    address: "123 Main St.",
    versionId: "va",
    propertyId: "p1",
  },
  {
    id: "b",
    path: "designs/b.jpg",
    room: "Living Room",
    style: "Coastal",
    versionNo: 1,
    status: "approved",
    address: "123 Main St.",
    versionId: "vb",
    propertyId: "p1",
  },
];

function mount(onDesigns = vi.fn()) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  mountSourcePicker(host, {
    context: "video",
    initialTab: "design",
    onFiles: async () => {},
    loadDesigns: async () => DESIGNS,
    onDesigns,
  } as any);
  return { host, onDesigns };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const card = (host: HTMLElement, id: string) =>
  host.querySelector<HTMLElement>('[data-sp-design="' + id + '"]')!;
const cont = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('[data-sp="dcontinue"]')!;

describe("video design source picker", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders one card per design with room, style and version", async () => {
    const { host } = mount();
    await tick();
    expect(host.querySelectorAll("[data-sp-design]").length).toBe(2);
    const text = card(host, "a").textContent || "";
    expect(text).toContain("Kitchen");
    expect(text).toContain("Warm Minimal");
    expect(text).toContain("2");
  });

  it("counts one and two selected designs in the footer", async () => {
    const { host } = mount();
    await tick();
    expect(cont(host).disabled).toBe(true);
    card(host, "a").click();
    await tick();
    expect(cont(host).textContent).toContain("Continue with 1 design");
    card(host, "b").click();
    await tick();
    expect(cont(host).textContent).toContain("Continue with 2 designs");
    /* Deselecting must walk the count back down. */
    card(host, "b").click();
    await tick();
    expect(cont(host).textContent).toContain("Continue with 1 design");
  });

  it("numbers the selection and keeps the image uncovered", async () => {
    const { host } = mount();
    await tick();
    card(host, "b").click();
    card(host, "a").click();
    await tick();
    expect(card(host, "b").querySelector(".spd-n")?.textContent).toBe("1");
    expect(card(host, "a").querySelector(".spd-n")?.textContent).toBe("2");
    /* The old red banner across the thumbnail is gone for good. */
    expect(host.querySelector(".sp-dcard-banner")).toBeNull();
    expect(card(host, "a").querySelector(".spd-check")).not.toBeNull();
  });

  it("previews without changing the selection", async () => {
    const { host } = mount();
    await tick();
    host.querySelector<HTMLElement>('[data-sp-preview="a"]')!.click();
    await tick();
    expect(host.querySelector(".spd-prev")).not.toBeNull();
    expect(cont(host).disabled).toBe(true);
  });

  it("hands selected designs to the caller in pick order, once each", async () => {
    const { host, onDesigns } = mount();
    await tick();
    card(host, "b").click();
    card(host, "a").click();
    await tick();
    cont(host).click();
    await tick();
    const picked = onDesigns.mock.calls[0]![0] as PickerDesign[];
    expect(picked.map((d) => d.id)).toEqual(["b", "a"]);
    expect(new Set(picked.map((d) => d.id)).size).toBe(picked.length);
  });

  it("cannot continue with nothing selected", async () => {
    const { host, onDesigns } = mount();
    await tick();
    cont(host).click();
    await tick();
    expect(onDesigns).not.toHaveBeenCalled();
  });

  it("shows an actionable empty state when no designs exist", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    mountSourcePicker(host, {
      context: "video",
      initialTab: "design",
      onFiles: async () => {},
      loadDesigns: async () => [],
      onDesigns: vi.fn(),
    } as any);
    await tick();
    expect(host.textContent).toContain("No saved designs yet");
    expect(host.querySelector('[data-sp="ddesign"]')).not.toBeNull();
  });
});
