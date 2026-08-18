// @vitest-environment jsdom
/**
 * Studio start page contract.
 *
 * The start screen is one decision (project type) followed by one upload
 * panel. These tests lock the source-picker half of that contract: tab sets
 * per creation mode, a single primary file action, and the Describe pane.
 */
import { describe, it, expect, vi } from "vitest";
import { mountSourcePicker, CONTEXT_CONFIG, SOURCE_META } from "@/lib/source-picker";

function mount(context: "design" | "video", opts: Record<string, unknown> = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const picker = mountSourcePicker(host, {
    context,
    esc: (s: string) => s,
    onPick: () => {},
    ...opts,
  } as any);
  return { host, picker };
}

describe("studio start source picker", () => {
  it("shows only the sources each creation mode supports", () => {
    expect(CONTEXT_CONFIG.design.sources).toEqual(["upload", "cloud", "property", "describe"]);
    expect(CONTEXT_CONFIG.video.sources).toEqual(["upload", "cloud", "property", "design"]);
    /* Describe is design-only until genuine text-to-video exists. */
    expect(CONTEXT_CONFIG.video.sources).not.toContain("describe");
  });

  it("uses compact tab labels with Lucide icons", () => {
    const { host } = mount("video");
    const labels = [...host.querySelectorAll(".sp-tab")].map((t) => t.textContent?.trim());
    expect(labels).toEqual(["Upload", "Cloud", "Property", "Design"]);
    expect(SOURCE_META.describe.icon).toBe("message-square-text");
  });

  it("offers exactly one primary file-selection action in the dropzone", () => {
    const { host } = mount("design");
    const drop = host.querySelector(".sp-drop")!;
    expect(drop.textContent).toContain("Drop Photos Here");
    expect(drop.textContent).toContain("Drag and drop, or");
    expect(host.querySelectorAll('[data-sp="browse"]').length).toBe(1);
    expect(host.textContent).not.toContain("Browse Files");
    expect(drop.getAttribute("role")).toBe("button");
    expect(drop.getAttribute("tabindex")).toBe("0");
  });

  it("clicking anywhere in the dropzone opens the file chooser", () => {
    const { host } = mount("design");
    const input = host.querySelector("input[type=file]") as HTMLInputElement;
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    (host.querySelector(".sp-drop") as HTMLElement).click();
    expect(click).toHaveBeenCalled();
  });

  it("Describe is a real tab with a prompt and one Create Concept action", () => {
    const onDescribe = vi.fn();
    const { host } = mount("design", { onDescribe });
    (host.querySelector('[data-sp-tab="describe"]') as HTMLElement).click();
    const ta = host.querySelector("#spPrompt") as HTMLTextAreaElement;
    expect(ta).toBeTruthy();
    ta.value = "A warm modern living room";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    const cta = host.querySelector('[data-sp="describe"]') as HTMLElement;
    expect(cta.textContent).toBe("Create Concept");
    cta.click();
    expect(onDescribe).toHaveBeenCalledWith("A warm modern living room");
  });

  it("marks the active tab with an accessible pressed state", () => {
    const { host } = mount("design");
    expect(host.querySelector('[data-sp-tab="upload"]')!.getAttribute("aria-pressed")).toBe("true");
    (host.querySelector('[data-sp-tab="cloud"]') as HTMLElement).click();
    expect(host.querySelector('[data-sp-tab="cloud"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('[data-sp-tab="upload"]')!.getAttribute("aria-pressed")).toBe("false");
  });
});
