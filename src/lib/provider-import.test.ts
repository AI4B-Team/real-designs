// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeProviderModal,
  importFromProvider,
  isSupportedPhotoName,
  providerAvailable,
  providerConfig,
} from "@/lib/provider-import";

const modal = () => document.querySelector<HTMLElement>(".rdpi-back");
const body = () => document.querySelector<HTMLElement>(".rdpi-b");

async function open(id: "drive" | "dropbox" = "drive", opts: any = {}) {
  const p = importFromProvider(id, { onFiles: () => {}, ...opts });
  await p;
  return modal()!;
}

describe("provider import", () => {
  beforeEach(() => {
    closeProviderModal();
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  it("reports an honest mode for each provider", () => {
    /* Without SDK keys the real, working share-link import is the path. */
    expect(providerConfig("drive").mode).toBe("link");
    expect(providerConfig("drive").missing.length).toBeGreaterThan(0);
    expect(providerConfig("dropbox").label).toBe("Dropbox");
    expect(providerAvailable("drive")).toBe(true);
    expect(providerAvailable("dropbox")).toBe(true);
  });

  it("only accepts supported photo types", () => {
    expect(isSupportedPhotoName("a.jpg")).toBe(true);
    expect(isSupportedPhotoName("a.HEIC")).toBe(true);
    expect(isSupportedPhotoName("a.pdf")).toBe(false);
    expect(isSupportedPhotoName("noext", "image/png")).toBe(true);
  });

  it("never opens an empty modal", async () => {
    const m = await open("drive");
    expect(m).toBeTruthy();
    expect(body()!.textContent!.trim().length).toBeGreaterThan(20);
    expect(m.querySelector("[data-rdpi-close]")).toBeTruthy();
    expect(m.querySelector(".rdpi")!.getAttribute("role")).toBe("dialog");
    expect(m.querySelector(".rdpi")!.getAttribute("aria-modal")).toBe("true");
    expect(m.querySelector(".rdpi")!.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("closes with the close button and restores scrolling and focus", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const m = await open("dropbox");
    expect(document.body.style.overflow).toBe("hidden");
    m.querySelector<HTMLElement>("[data-rdpi-close]")!.click();
    expect(modal()).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Escape and on backdrop click", async () => {
    await open("drive");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(modal()).toBeNull();

    const m = await open("drive");
    m.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal()).toBeNull();
  });

  it("cancel closes the dialog", async () => {
    const m = await open("drive");
    const cancel = Array.from(m.querySelectorAll<HTMLElement>("[data-rdpi-close]")).pop()!;
    cancel.click();
    expect(modal()).toBeNull();
  });

  it("offers a computer fallback that closes the overlay", async () => {
    const onComputer = vi.fn();
    const m = await open("dropbox", { onComputer });
    m.querySelector<HTMLElement>("[data-rdpi-computer]")!.click();
    expect(onComputer).toHaveBeenCalledTimes(1);
    expect(modal()).toBeNull();
  });

  it("does not stack overlays when the button is clicked twice", async () => {
    await open("drive");
    await importFromProvider("drive", { onFiles: () => {} });
    expect(document.querySelectorAll(".rdpi-back").length).toBe(1);
  });

  it("keeps the page usable after a failed import", async () => {
    const m = await open("drive");
    const area = m.querySelector<HTMLTextAreaElement>("[data-rdpi-links]")!;
    area.value = "https://drive.google.com/file/d/abcdefghijkl/view";
    m.querySelector<HTMLElement>("[data-rdpi-go]")!.click();
    await new Promise((r) => setTimeout(r, 0));
    /* The server call fails in tests: an error state, never a blank panel. */
    await vi.waitFor(() => {
      expect(body()!.textContent!.trim().length).toBeGreaterThan(10);
    });
    closeProviderModal();
    expect(modal()).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});
