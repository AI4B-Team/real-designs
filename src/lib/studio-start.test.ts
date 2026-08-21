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
    expect(labels).toEqual(["Upload", "Cloud", "Property", "Designs"]);
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

  it("Describe is one composer with a disabled-until-valid Generate action", () => {
    const onDescribe = vi.fn();
    const { host } = mount("design", { onDescribe });
    (host.querySelector('[data-sp-tab="describe"]') as HTMLElement).click();
    const ta = host.querySelector('[data-sp-f="prompt"]') as HTMLTextAreaElement;
    expect(ta).toBeTruthy();
    expect(ta.placeholder.startsWith("Describe what you want to create")).toBe(true);
    expect(host.textContent).toContain("Describe Your Space");
    expect(host.querySelector('[data-sp="addref"]')).toBeTruthy();
    expect(host.querySelector('[data-sp="improve"]')).toBeTruthy();
    const cta = () => host.querySelector('[data-sp="describe"]') as HTMLButtonElement;
    expect(cta().disabled).toBe(true);
    expect(cta().textContent).toContain("Generate");
    /* whitespace only stays disabled */
    ta.value = "   ";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    expect(cta().disabled).toBe(true);
    ta.value = "A warm modern living room";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    expect(cta().disabled).toBe(false);
    cta().click();
    expect(onDescribe).toHaveBeenCalledWith(
      "A warm modern living room",
      expect.objectContaining({ ratio: "16:9", options: 2, references: [] }),
    );
  });

  it("shows the output summary and updates it from Add Details", () => {
    const { host } = mount("design");
    (host.querySelector('[data-sp-tab="describe"]') as HTMLElement).click();
    expect(host.querySelector(".sp-meta")!.textContent).toContain("16:9");
    expect(host.querySelector(".sp-meta")!.textContent).toContain("2 options");
    (host.querySelector('[data-sp-ratio="1:1"]') as HTMLElement).click();
    (host.querySelector('[data-sp-opt="1"]') as HTMLElement).click();
    expect(host.querySelector(".sp-meta")!.textContent).toContain("1:1");
    expect(host.querySelector(".sp-meta")!.textContent).toContain("1 option");
    expect((host.querySelector('[data-sp="describe"]') as HTMLElement).textContent).toContain(
      "1 Credit",
    );
  });

  it("example chips fill the prompt without submitting", () => {
    const onDescribe = vi.fn();
    const { host } = mount("design", { onDescribe });
    (host.querySelector('[data-sp-tab="describe"]') as HTMLElement).click();
    const chip = host.querySelector('[data-sp-ex="Resort Backyard"]') as HTMLElement;
    chip.click();
    expect((host.querySelector('[data-sp-f="prompt"]') as HTMLTextAreaElement).value).toBe(
      "Resort Backyard",
    );
    expect(onDescribe).not.toHaveBeenCalled();
  });


  it("Cmd/Ctrl+Enter submits and duplicate submits are ignored while busy", async () => {
    let release: () => void = () => {};
    const onDescribe = vi.fn(() => new Promise<void>((r) => (release = () => r())));
    const { host } = mount("design", { onDescribe });
    (host.querySelector('[data-sp-tab="describe"]') as HTMLElement).click();
    const ta = host.querySelector('[data-sp-f="prompt"]') as HTMLTextAreaElement;
    ta.value = "A coastal backyard with a plunge pool";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }));
    await Promise.resolve();
    const cta = host.querySelector('[data-sp="describe"]') as HTMLButtonElement;
    expect(cta.textContent).toContain("Creating");
    expect(cta.disabled).toBe(true);
    cta.click();
    expect(onDescribe).toHaveBeenCalledTimes(1);
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect((host.querySelector('[data-sp="describe"]') as HTMLButtonElement).textContent).toContain(
      "Create",
    );
  });

  it("plain Enter does not submit", () => {
    const onDescribe = vi.fn();
    const { host } = mount("design", { onDescribe });
    (host.querySelector('[data-sp-tab="describe"]') as HTMLElement).click();
    const ta = host.querySelector('[data-sp-f="prompt"]') as HTMLTextAreaElement;
    ta.value = "Line one";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onDescribe).not.toHaveBeenCalled();
  });

  it("marks the active tab with an accessible pressed state", () => {
    const { host } = mount("design");
    expect(host.querySelector('[data-sp-tab="upload"]')!.getAttribute("aria-pressed")).toBe("true");
    (host.querySelector('[data-sp-tab="cloud"]') as HTMLElement).click();
    expect(host.querySelector('[data-sp-tab="cloud"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('[data-sp-tab="upload"]')!.getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
});
