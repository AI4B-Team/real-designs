// @vitest-environment jsdom
/**
 * Card images must survive an expiring signed URL: the path is the source of
 * truth, a stale URL is re-signed in place, and only a repeated failure shows
 * the retry state.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolve = vi.fn();
vi.mock("@/lib/room-photos", () => ({
  resolvePhotoUrl: (...a: any[]) => resolve(...a),
  isStoredPhoto: (p: string) => !/^(https?:|blob:|\/|data:)/.test(p),
  signedPhotoExpiry: () => null,
}));

const load = async () => {
  vi.resetModules();
  return import("@/lib/photo-src");
};

beforeEach(() => {
  resolve.mockReset();
  document.body.innerHTML = "";
  /* jsdom never fetches, so stand in for a frame that loads successfully —
     every URL here is a healthy one. */
  class OkImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    set src(_v: string) {
      setTimeout(() => this.onload && this.onload(), 0);
    }
  }
  (globalThis as any).Image = OkImage as any;
});

describe("resilient photo source", () => {
  it("paints a background element from its storage path", async () => {
    resolve.mockResolvedValue("https://cdn.test/a.jpg?token=x");
    const { paintPhotoEl } = await load();
    document.body.innerHTML = `<div data-img="u/1.jpg"></div>`;
    const el = document.querySelector("[data-img]") as HTMLElement;
    expect(await paintPhotoEl(el)).toBe(true);
    expect(el.style.backgroundImage).toContain("https://cdn.test/a.jpg");
    expect(el.querySelector(".rd-img-fail-b")).toBeNull();
  });

  it("retries once with a refreshed URL before failing visibly", async () => {
    resolve.mockResolvedValueOnce(null).mockResolvedValueOnce("https://cdn.test/b.jpg?token=y");
    const { paintPhotoEl } = await load();
    document.body.innerHTML = `<div data-img="u/2.jpg"></div>`;
    const el = document.querySelector("[data-img]") as HTMLElement;
    expect(await paintPhotoEl(el)).toBe(true);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve.mock.calls[1]?.[1]).toMatchObject({ force: true });
    expect(el.style.backgroundImage).toContain("b.jpg");
  });

  it("shows a load failure with Retry when recovery fails, keeping the card", async () => {
    resolve.mockResolvedValue(null);
    const { paintPhotoEl } = await load();
    document.body.innerHTML = `<div data-img="u/3.jpg"><span class="meta">Kitchen</span></div>`;
    const el = document.querySelector("[data-img]") as HTMLElement;
    expect(await paintPhotoEl(el)).toBe(false);
    expect(el.textContent).toContain("Photo couldn’t be loaded");
    expect(el.querySelector(".meta")).toBeTruthy();
  });

  it("reuses a fresh URL and re-signs only once it is stale", async () => {
    resolve.mockResolvedValue("https://cdn.test/c.jpg?token=z");
    const { photoSrc, photoSrcStale, invalidatePhotoSrc } = await load();
    await photoSrc("u/4.jpg");
    await photoSrc("u/4.jpg");
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(photoSrcStale("u/4.jpg")).toBe(false);
    invalidatePhotoSrc("u/4.jpg");
    expect(photoSrcStale("u/4.jpg")).toBe(true);
    await photoSrc("u/4.jpg");
    expect(resolve).toHaveBeenCalledTimes(2);
  });
});
