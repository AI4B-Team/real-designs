// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeProviderModal,
  importFromProvider,
  isSupportedPhotoName,
  providerAvailable,
  providerConfig,
  providerUnavailableMessage,
} from "@/lib/provider-import";

const modal = () => document.querySelector<HTMLElement>(".rdpi-back");
const body = () => document.querySelector<HTMLElement>(".rdpi-b");

function configure() {
  (globalThis as any).__RD_PROVIDER_ENV = {
    VITE_GOOGLE_PICKER_CLIENT_ID: "cid",
    VITE_GOOGLE_PICKER_API_KEY: "key",
    VITE_DROPBOX_APP_KEY: "dbx",
  };
}

async function open(id: "drive" | "dropbox" = "drive", opts: any = {}) {
  await importFromProvider(id, { onFiles: () => {}, ...opts });
  return modal()!;
}

describe("provider import", () => {
  beforeEach(() => {
    closeProviderModal();
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });
  afterEach(() => {
    delete (globalThis as any).__RD_PROVIDER_ENV;
    vi.unstubAllEnvs();
  });

  it("is honestly unavailable when the integration is not configured", async () => {
    expect(providerConfig("drive").configured).toBe(false);
    expect(providerConfig("drive").missing.length).toBeGreaterThan(0);
    expect(providerAvailable("dropbox")).toBe(false);
    expect(providerUnavailableMessage("drive")).toContain("isn't available yet");

    const onUnavailable = vi.fn();
    const opened = await importFromProvider("drive", { onFiles: () => {}, onUnavailable });
    expect(opened).toBe(false);
    expect(modal()).toBeNull();
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it("only accepts supported photo types", () => {
    expect(isSupportedPhotoName("a.jpg")).toBe(true);
    expect(isSupportedPhotoName("a.HEIC")).toBe(true);
    expect(isSupportedPhotoName("a.pdf")).toBe(false);
    expect(isSupportedPhotoName("noext", "image/png")).toBe(true);
  });

  it("opens a provider-only modal with no source navigation", async () => {
    configure();
    const m = await open("drive");
    expect(m).toBeTruthy();
    expect(body()!.textContent).toContain("Connect Google Drive to choose photos");
    expect(m.textContent).not.toContain("Dropbox");
    expect(m.textContent).not.toContain("Describe");
    expect(m.textContent).not.toContain("Link");
    expect(m.querySelector("[data-rdpi-links]")).toBeNull();
    expect(m.querySelector("[data-rdpi-connect]")!.textContent).toContain("Connect Google Drive");
    expect(m.querySelector(".rdpi")!.getAttribute("role")).toBe("dialog");
  });

  it("gives Dropbox its own modal", async () => {
    configure();
    const m = await open("dropbox");
    expect(body()!.textContent).toContain("Connect Dropbox to choose photos");
    expect(m.textContent).not.toContain("Google Drive");
  });

  it("closes with the close button and restores scrolling and focus", async () => {
    configure();
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
    configure();
    await open("drive");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(modal()).toBeNull();

    const m = await open("drive");
    m.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal()).toBeNull();
  });

  it("cancel closes the dialog", async () => {
    configure();
    const m = await open("drive");
    Array.from(m.querySelectorAll<HTMLElement>("[data-rdpi-close]")).pop()!.click();
    expect(modal()).toBeNull();
  });

  it("does not stack overlays when the button is clicked twice", async () => {
    configure();
    await open("drive");
    await importFromProvider("drive", { onFiles: () => {} });
    expect(document.querySelectorAll(".rdpi-back").length).toBe(1);
  });

  it("connects for real and keeps every exit working", async () => {
    configure();
    const m = await open("drive", { onComputer: vi.fn() });
    m.querySelector<HTMLElement>("[data-rdpi-connect]")!.click();
    await vi.waitFor(() => {
      expect(body()!.textContent).toContain("Connecting To Google Drive");
    });
    /* Nothing is ever reported as connected before authorization returns. */
    expect(m.textContent).not.toContain("Choose Photos");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(modal()).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("Unconfigured provider", () => {
  it("opens an honest explanation with a Choose From Computer way out", async () => {
    const { importFromProvider } = await import("@/lib/provider-import");
    const onComputer = vi.fn();
    const ok = await importFromProvider("drive", { onFiles: () => {}, onComputer });
    expect(ok).toBe(true);
    const modal = document.querySelector(".rdpi") as HTMLElement;
    expect(modal).not.toBeNull();
    /* Never a blank overlay. */
    expect(modal.textContent).toContain("Google Drive isn't connected yet");
    const alt = modal.querySelector<HTMLElement>("[data-rdpi-computer]")!;
    expect(alt.textContent).toContain("Choose From Computer");
    alt.click();
    expect(onComputer).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".rdpi")).toBeNull();
  });
});
