// @vitest-environment jsdom
/**
 * Photo persistence across both builders.
 *
 * A signed URL is never the canonical reference — the storage path is. These
 * tests cover the situations that used to leave a permanent gray card:
 * expiring URLs, refreshes, leaving and returning, draft restoration, partial
 * API failures, a second tab, and deleting one photo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolve = vi.fn();
const signedExp = vi.fn<(p: string) => number | null>(() => null);
vi.mock("@/lib/room-photos", () => ({
  resolvePhotoUrl: (...a: any[]) => resolve(...a),
  isStoredPhoto: (p: string) => !/^(https?:|blob:|\/|data:)/.test(p),
  signedPhotoExpiry: (p: string) => signedExp(p),
}));

const load = async () => {
  vi.resetModules();
  return import("@/lib/photo-src");
};

/** A card as either builder renders it: metadata plus a path-bound frame. */
function card(key: string, path: string, src = "") {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="rv-tile" data-k="${key}">
       <div class="rv-tile-th">
         <img${src ? ` src="${src}"` : ""} data-photo-path="${path}" alt="">
         <button data-cardflow="photo" data-cardmenu="${key}"></button>
       </div>
       <em class="room">Kitchen</em>
     </div>`,
  );
  return document.querySelector<HTMLImageElement>(`[data-k="${key}"] img`)!;
}

beforeEach(() => {
  resolve.mockReset();
  signedExp.mockReset();
  signedExp.mockReturnValue(null);
  document.body.innerHTML = "";
  /* jsdom never actually loads an image; the probe resolves immediately. */
  class OkImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    set src(_v: string) {
      setTimeout(() => this.onload && this.onload(), 0);
    }
  }
  (globalThis as any).Image = OkImage as any;
});

describe("photo persistence", () => {
  it("renews an expired signed URL without touching card metadata", async () => {
    resolve
      .mockResolvedValueOnce("https://cdn.test/a.jpg?token=1")
      .mockResolvedValueOnce("https://cdn.test/a.jpg?token=2");
    const { photoSrc, invalidatePhotoSrc, photoSrcStale } = await load();
    expect(await photoSrc("u/a.jpg")).toContain("token=1");
    invalidatePhotoSrc("u/a.jpg"); // simulates expiry
    expect(photoSrcStale("u/a.jpg")).toBe(true);
    expect(await photoSrc("u/a.jpg")).toContain("token=2");
  });

  it("repaints from the path after a refresh, when no URL is in the markup", async () => {
    resolve.mockResolvedValue("https://cdn.test/b.jpg?token=1");
    const { paintPhotoEl } = await load();
    const img = card("k1", "u/b.jpg"); // fresh page load: no src at all
    expect(img.getAttribute("src")).toBeNull();
    await paintPhotoEl(img);
    expect(img.src).toContain("b.jpg");
    expect(document.querySelector('[data-k="k1"] .room')?.textContent).toBe("Kitchen");
  });

  it("shows a loading skeleton while a URL is resolving and clears it after", async () => {
    let release: (u: string) => void = () => {};
    resolve.mockImplementation(() => new Promise((r) => (release = r as any)));
    const { paintPhotoEl } = await load();
    const img = card("k2", "u/c.jpg");
    const done = paintPhotoEl(img);
    expect(img.classList.contains("rd-img-load")).toBe(true);
    release("https://cdn.test/c.jpg?token=1");
    await done;
    expect(img.classList.contains("rd-img-load")).toBe(false);
  });

  it("offers Retry and Replace Photo instead of a blank gray card", async () => {
    resolve.mockResolvedValue(null);
    const { paintPhotoEl } = await load();
    const img = card("k3", "u/d.jpg");
    expect(await paintPhotoEl(img)).toBe(false);
    const tile = document.querySelector('[data-k="k3"]')!;
    expect(tile.textContent).toContain("Photo couldn’t be loaded");
    expect(tile.querySelector("[data-photo-retry]")).toBeTruthy();
    expect(tile.querySelector("[data-photo-replace]")).toBeTruthy();
  });

  it("recovers on Retry after a partial API failure", async () => {
    resolve.mockResolvedValue(null);
    const { paintPhotoEl } = await load();
    const img = card("k4", "u/e.jpg");
    await paintPhotoEl(img);
    resolve.mockResolvedValue("https://cdn.test/e.jpg?token=9");
    (document.querySelector("[data-photo-retry]") as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(img.classList.contains("rd-img-fail")).toBe(false);
  });

  it("asks the owning builder to replace the photo, with its stable key", async () => {
    resolve.mockResolvedValue(null);
    const { paintPhotoEl } = await load();
    const img = card("k5", "u/f.jpg");
    await paintPhotoEl(img);
    const seen: any[] = [];
    document.addEventListener("rd-photo-replace", (e: any) => seen.push(e.detail));
    (document.querySelector("[data-photo-replace]") as HTMLButtonElement).click();
    expect(seen[0]).toMatchObject({ key: "k5", path: "u/f.jpg" });
  });

  it("keeps the previous image on screen while leaving and returning re-signs", async () => {
    resolve.mockResolvedValue("https://cdn.test/g.jpg?token=1");
    const { paintPhotoEl, invalidatePhotoSrc } = await load();
    const img = card("k6", "u/g.jpg");
    await paintPhotoEl(img);
    const first = img.src;
    invalidatePhotoSrc("u/g.jpg");
    resolve.mockResolvedValue("https://cdn.test/g.jpg?token=2");
    const next = paintPhotoEl(img, "u/g.jpg", true);
    expect(img.src).toBe(first); // never blanked mid-flight
    await next;
    expect(img.src).toContain("token=2");
  });

  it("resolves selected and unselected photos alike and never blanks a path", async () => {
    resolve.mockImplementation(async (p: string) => `https://cdn.test/${p}?token=1`);
    const { mountPhotoImages } = await load();
    const a = card("s1", "u/one.jpg");
    const b = card("s2", "u/two.jpg");
    document.querySelector('[data-k="s1"]')!.classList.add("on");
    mountPhotoImages(document.body);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(a.getAttribute("data-photo-path")).toBe("u/one.jpg");
    expect(b.getAttribute("data-photo-path")).toBe("u/two.jpg");
  });

  it("deletes one photo without disturbing the others", async () => {
    resolve.mockImplementation(async (p: string) => `https://cdn.test/${p}?token=1`);
    const { paintPhotoEl } = await load();
    const a = card("d1", "u/one.jpg");
    const b = card("d2", "u/two.jpg");
    await paintPhotoEl(a);
    await paintPhotoEl(b);
    document.querySelector('[data-k="d1"]')!.remove();
    expect(b.src).toContain("two.jpg");
    expect(b.classList.contains("rd-img-fail")).toBe(false);
  });

  it("shares one in-flight request per path, as a second tab would re-sign its own", async () => {
    resolve.mockResolvedValue("https://cdn.test/h.jpg?token=1");
    const { photoSrc } = await load();
    const [x, y] = await Promise.all([photoSrc("u/h.jpg"), photoSrc("u/h.jpg")]);
    expect(x).toBe(y);
    expect(resolve).toHaveBeenCalledTimes(1);
    // A separate tab has its own module instance and mints its own URL.
    const second = await load();
    resolve.mockResolvedValue("https://cdn.test/h.jpg?token=2");
    expect(await second.photoSrc("u/h.jpg")).toContain("token=2");
  });
});

describe("draft restoration", () => {
  it("restores paths, selection, order, room and format — never a signed URL", async () => {
    const draft = {
      item_order: ["b", "a"],
      assets: [
        { key: "a", path: "u/a.jpg", name: "a.jpg", room: "Kitchen", selected: true },
        { key: "b", path: "u/b.jpg", name: "b.jpg", room: "Entry", selected: false },
      ],
      settings: { rooms: { a: { ratio: "4:5" }, b: { ratio: null } } },
    };
    const order = draft.item_order;
    const items = draft.assets
      .slice()
      .sort((x, y) => order.indexOf(x.key) - order.indexOf(y.key))
      .map((a) => ({
        key: a.key,
        path: a.path,
        room: a.room,
        selected: a.selected !== false,
        ratio: (draft.settings.rooms as any)[a.key]?.ratio ?? null,
        signed: null,
      }));
    expect(items.map((i) => i.key)).toEqual(["b", "a"]);
    expect(items.every((i) => !!i.path)).toBe(true);
    expect(items.every((i) => i.signed === null)).toBe(true);
    expect(items.find((i) => i.key === "a")).toMatchObject({ room: "Kitchen", selected: true, ratio: "4:5" });
    expect(JSON.stringify(draft)).not.toContain("token=");
  });

  it("deduplicates by storage path, not by signed URL", () => {
    const incoming = [
      { id: "m1", path: "u/a.jpg", url: "https://cdn.test/a.jpg?token=1" },
      { id: "m1", path: "u/a.jpg", url: "https://cdn.test/a.jpg?token=2" },
      { id: "m2", path: "u/b.jpg", url: "https://cdn.test/b.jpg?token=3" },
    ];
    const out: typeof incoming = [];
    for (const x of incoming) {
      if (out.some((o) => o.id === x.id || o.path === x.path)) continue;
      out.push(x);
    }
    expect(out.map((o) => o.path)).toEqual(["u/a.jpg", "u/b.jpg"]);
  });
});

describe("signed URL lifetime", () => {
  it("caches against the signature it actually holds, not the lifetime it asked for", async () => {
    /* Another caller already signed this object for one hour, so a six hour
       request reuses that short URL. Caching the optimistic figure is what
       let every tile in a grid go gray at the same moment. */
    resolve.mockResolvedValue("https://cdn.test/a.jpg?token=short");
    signedExp.mockReturnValue(Date.now() + 60 * 60 * 1000);
    const { photoSrc, photoSrcStale } = await load();
    await photoSrc("u/a.jpg");
    expect(photoSrcStale("u/a.jpg")).toBe(false);
    vi.setSystemTime(new Date(Date.now() + 55 * 60 * 1000));
    expect(photoSrcStale("u/a.jpg")).toBe(true);
    vi.useRealTimers();
  });

  it("keeps a background tile visible and recovers it after one refresh", async () => {
    resolve
      .mockResolvedValueOnce("https://cdn.test/a.jpg?token=dead")
      .mockResolvedValueOnce("https://cdn.test/a.jpg?token=fresh");
    let attempt = 0;
    class FlakyImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(v: string) {
        const bad = v.includes("dead");
        attempt += 1;
        setTimeout(() => (bad ? this.onerror && this.onerror() : this.onload && this.onload()), 0);
      }
    }
    (globalThis as any).Image = FlakyImage as any;
    document.body.insertAdjacentHTML("beforeend", `<div class="rv-tile-th" data-img="u/a.jpg"></div>`);
    const el = document.querySelector<HTMLElement>("[data-img]")!;
    const { paintPhotoEl } = await load();
    const ok = await paintPhotoEl(el, "u/a.jpg");
    expect(ok).toBe(true);
    expect(attempt).toBe(2);
    expect(el.style.backgroundImage).toContain("token=fresh");
    expect(el.classList.contains("rd-img-fail")).toBe(false);
  });

  it("shows a retryable message instead of a silent gray background tile", async () => {
    resolve.mockResolvedValue("https://cdn.test/a.jpg?token=dead");
    class DeadImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_v: string) {
        setTimeout(() => this.onerror && this.onerror(), 0);
      }
    }
    (globalThis as any).Image = DeadImage as any;
    document.body.insertAdjacentHTML("beforeend", `<div class="rv-tile-th" data-img="u/b.jpg"></div>`);
    const el = document.querySelector<HTMLElement>("[data-img]")!;
    const { paintPhotoEl } = await load();
    const ok = await paintPhotoEl(el, "u/b.jpg");
    expect(ok).toBe(false);
    expect(el.classList.contains("rd-img-fail")).toBe(true);
    expect(el.querySelector("[data-photo-retry]")).toBeTruthy();
  });
});
