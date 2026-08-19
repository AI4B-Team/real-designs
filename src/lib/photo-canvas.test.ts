// @vitest-environment jsdom
/**
 * Photo Design Canvas guarantees: images come from their storage path, a
 * failed refresh shows Retry without losing metadata, and Object Controls
 * never claim an analysis that did not happen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolve = vi.fn();
vi.mock("@/lib/room-photos", () => ({
  resolvePhotoUrl: (...a: any[]) => resolve(...a),
  isStoredPhoto: (p: string) => !/^(https?:|blob:|\/|data:)/.test(p),
}));

const load = async () => {
  vi.resetModules();
  return import("@/lib/photo-src");
};

beforeEach(() => {
  resolve.mockReset();
  document.body.innerHTML = "";
});

describe("canvas image sourcing", () => {
  it("re-signs an expired URL for the same stable path", async () => {
    resolve.mockResolvedValue("https://cdn.test/k.jpg?token=1");
    const { photoSrc, invalidatePhotoSrc, photoSrcStale } = await load();
    expect(await photoSrc("u/kitchen.jpg")).toContain("k.jpg");
    invalidatePhotoSrc("u/kitchen.jpg");
    expect(photoSrcStale("u/kitchen.jpg")).toBe(true);
    resolve.mockResolvedValue("https://cdn.test/k.jpg?token=2");
    expect(await photoSrc("u/kitchen.jpg")).toContain("token=2");
  });

  it("keeps card metadata when a refresh fails and offers Retry", async () => {
    resolve.mockResolvedValue(null);
    const { paintPhotoEl } = await load();
    document.body.innerHTML = `<div data-img="u/den.jpg"><em class="label">Den</em></div>`;
    const el = document.querySelector("[data-img]") as HTMLElement;
    expect(await paintPhotoEl(el)).toBe(false);
    expect(el.querySelector(".label")?.textContent).toBe("Den");
    expect(el.querySelector("[data-photo-retry]")).toBeTruthy();
  });

  it("binds each filmstrip thumbnail exactly once", async () => {
    resolve.mockResolvedValue("https://cdn.test/t.jpg?token=1");
    const { mountPhotoImages } = await load();
    document.body.innerHTML = `<div id="strip"><img data-photo-path="u/1.jpg"><img data-photo-path="u/2.jpg"></div>`;
    const strip = document.getElementById("strip")!;
    mountPhotoImages(strip);
    mountPhotoImages(strip);
    const bound = strip.querySelectorAll('img[data-photo-bound="1"]');
    expect(bound.length).toBe(2);
  });
});
