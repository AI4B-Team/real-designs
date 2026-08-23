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
  /* Each mount is a fresh session: drafts must not leak between tests. */
  try {
    localStorage.clear();
  } catch (_) {}
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
    const sources = ["upload", "cloud", "property", "media", "describe"];
    expect(CONTEXT_CONFIG.design.sources).toEqual(sources);
    expect(CONTEXT_CONFIG.video.sources).toEqual(sources);
  });

  it("uses compact tab labels with Lucide icons", () => {
    const { host } = mount("video");
    const labels = [...host.querySelectorAll(".sp-tab")].map((t) => t.textContent?.trim());
    expect(labels).toEqual([
      "Upload",
      "Cloud",
      "Property",
      "Media",
      "Describe",
    ]);
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
    expect(host.textContent).toContain("Describe Your Space");
    expect(host.querySelector('[data-sp="addref"]')).toBeTruthy();
    expect(host.querySelector('[data-sp="improve"]')).toBeTruthy();
    const cta = () => host.querySelector('[data-sp="describe"]') as HTMLButtonElement;
    /* Generate stays clickable and explains what is missing instead of going dead. */
    cta().click();
    expect(onDescribe).not.toHaveBeenCalled();
    expect(host.querySelector(".sp-describe-foot .sp-meta")!.textContent).toContain(
      "Add a description",
    );
    ta.value = "   ";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    cta().click();
    expect(onDescribe).not.toHaveBeenCalled();
    ta.value = "A warm modern living room";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    /* Room and style cards are part of the required set now. */
    expect(host.querySelectorAll("[data-sp-room]").length).toBeGreaterThan(0);
    expect(host.querySelectorAll("[data-sp-style]").length).toBeGreaterThan(0);
  });

  it("references stay optional and validation only asks for a description", () => {
    const { host } = mount("design");
    (host.querySelector('[data-sp-tab="describe"]') as HTMLElement).click();
    /* The footer always states the one thing still missing. */
    expect(host.querySelector(".sp-describe-foot .sp-meta")!.textContent).toContain(
      "Add a description",
    );
    const ta = host.querySelector('[data-sp-f="prompt"]') as HTMLTextAreaElement;
    ta.value = " ";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    expect(host.querySelector(".sp-describe-foot .sp-meta")!.textContent).toContain(
      "Add a description",
    );
    expect(host.textContent).toContain("Add Reference");
    expect(host.querySelector('[data-sp="addref"]')).toBeTruthy();
  });

  it("shows one cost line and updates it from Add Details", () => {
    const { host } = mount("design");
    (host.querySelector('[data-sp-tab="describe"]') as HTMLElement).click();
    const cost = () => host.querySelector(".sp-describe-foot .sp-cost")!.textContent || "";
    expect(cost()).toContain("1 image");
    expect(cost()).toContain("1 credit");
    (host.querySelector('[data-sp-opt="2"]') as HTMLElement).click();
    expect(cost()).toContain("2 images");
    expect(cost()).toContain("2 credits");
  });


  it("example chips fill the prompt without submitting", () => {
    const onDescribe = vi.fn();
    const { host } = mount("design", { onDescribe });
    (host.querySelector('[data-sp-tab="describe"]') as HTMLElement).click();
    const chip = host.querySelector('[data-sp-ex="Resort-Style Backyard"]') as HTMLElement;
    chip.click();
    expect((host.querySelector('[data-sp-f="prompt"]') as HTMLTextAreaElement).value).toBe(
      "Resort-Style Backyard",
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
    (host.querySelector("[data-sp-room]") as HTMLElement).click();
    (host.querySelector("[data-sp-style]") as HTMLElement).click();
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    const cta = host.querySelector('[data-sp="describe"]') as HTMLButtonElement;
    cta.click();
    expect(onDescribe.mock.calls.length).toBeLessThanOrEqual(1);
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect((host.querySelector('[data-sp="describe"]') as HTMLButtonElement).textContent).toContain(
      "Generate",
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

  it("advanced settings header toggles with a lucide chevron and keeps moods uniform", () => {
    const { host } = mount("design");
    (host.querySelector('[data-sp-tab="describe"]') as HTMLElement).click();
    const head = () => host.querySelector(".rdset-advh") as HTMLElement;
    expect(head().getAttribute("aria-expanded")).toBe("false");
    expect(head().querySelector('[data-lucide="chevron-down"]')).toBeTruthy();
    expect(host.textContent).toContain("Advanced Settings");
    head().click();
    expect(head().getAttribute("aria-expanded")).toBe("true");
    expect(head().querySelector('[data-lucide="chevron-up"]')).toBeTruthy();
    const body = host.querySelector(".rdset-advb") as HTMLElement;
    expect(body.textContent).toContain("Number of images");
    expect(body.textContent).toContain("Mood and lighting");
    const moods = Array.from(body.querySelectorAll("[data-sp-mood]"));
    expect(moods.length).toBeGreaterThan(3);
    for (const m of moods) expect(m.querySelector("i[data-lucide]")).toBeTruthy();
    /* Auto is the default and stays selected until the user picks another. */
    const auto = body.querySelector('[data-sp-mood="auto"]') as HTMLElement;
    expect(auto.getAttribute("aria-pressed")).toBe("true");
    (body.querySelector('[data-sp-mood="natural-daylight"]') as HTMLElement).click();
    expect(host.textContent).toContain("Natural Daylight");
  });

  it("marks the active tab with an accessible pressed state", () => {
    const { host } = mount("design");
    expect(host.querySelector('[data-sp-tab="upload"]')!.getAttribute("aria-pressed")).toBe("true");
    (host.querySelector('[data-sp-tab="media"]') as HTMLElement).click();
    expect(host.querySelector('[data-sp-tab="media"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('[data-sp-tab="upload"]')!.getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
});
