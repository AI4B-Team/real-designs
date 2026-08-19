/**
 * Shared resilient photo source for both builders.
 *
 * Photo Design cards and Video Builder scene cards show the same private
 * storage objects. Storage hands out *signed* URLs that expire, so a URL is
 * never the source of truth — the storage path is. This module owns the
 * lifecycle: resolve a path to a currently-valid URL, keep the last good
 * image on screen while a fresh URL is minted, retry once on failure, and
 * only then show a small "Image unavailable — Retry" state. Card metadata
 * (selection, room, effects, order) is never touched by any of it.
 */
import { isStoredPhoto, resolvePhotoUrl } from "@/lib/room-photos";

/** Signed-URL lifetime we ask storage for, and how early we re-sign. */
const TTL_SEC = 6 * 3600;
const MARGIN_MS = 10 * 60 * 1000;
const SWEEP_MS = 60 * 1000;

type Entry = { url: string; exp: number };

const CACHE = new Map<string, Entry>();
const INFLIGHT = new Map<string, Promise<string | null>>();

const DEV = (() => {
  try {
    return !!(import.meta as any).env?.DEV;
  } catch (_) {
    return false;
  }
})();

function kindOf(url: string) {
  if (url.startsWith("blob:")) return "blob";
  if (url.includes("/object/sign/") || url.includes("token=")) return "signed";
  return "permanent";
}

function log(...args: unknown[]) {
  if (DEV) console.debug("[photo]", ...args);
}

/** Never log a token: strip the query from signed URLs before reporting. */
function safeUrl(url: string) {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q) + "?…";
}

/** Current valid URL for a storage path, minting a new one when needed. */
export async function photoSrc(path: string, force = false): Promise<string | null> {
  if (!path) return null;
  const hit = CACHE.get(path);
  if (!force && hit && hit.exp > Date.now()) return hit.url;
  const key = (force ? "!" : "") + path;
  const running = INFLIGHT.get(key);
  if (running) return running;

  const req = (async () => {
    let url: string | null = null;
    try {
      url = await resolvePhotoUrl(path, { expiresIn: TTL_SEC, force });
    } catch (_) {
      url = null;
    }
    if (url) {
      const perm = !isStoredPhoto(path);
      CACHE.set(path, { url, exp: perm ? Infinity : Date.now() + (TTL_SEC * 1000 - MARGIN_MS) });
      log("resolved", { path, kind: kindOf(url), url: safeUrl(url), refresh: force });
    } else {
      log("resolve failed", { path, refresh: force });
    }
    return url;
  })().finally(() => INFLIGHT.delete(key));

  INFLIGHT.set(key, req);
  return req;
}

/** True when the cached URL for a path is about to expire (or is gone). */
export function photoSrcStale(path: string) {
  const hit = CACHE.get(path);
  return !hit || hit.exp <= Date.now();
}

/** Drop a cached URL, e.g. after the object was replaced. */
export function invalidatePhotoSrc(path: string) {
  CACHE.delete(path);
}

/* ------------------------------------------------------------------ */
/* DOM binding                                                         */
/* ------------------------------------------------------------------ */

type El = HTMLElement & { __rdPhotoSeq?: number; __rdPhotoTries?: number };

let seq = 0;

function failState(el: El, path: string) {
  el.classList.add("rd-img-fail");
  if (!el.querySelector(".rd-img-fail-b")) {
    el.insertAdjacentHTML(
      "beforeend",
      `<span class="rd-img-fail-b" role="status">Image unavailable · <button type="button" data-photo-retry>Retry</button></span>`,
    );
    el.querySelector("[data-photo-retry]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      el.querySelector(".rd-img-fail-b")?.remove();
      el.classList.remove("rd-img-fail");
      el.__rdPhotoTries = 0;
      void paintPhotoEl(el, path, true);
    });
  }
  log("unavailable", { path });
}

/**
 * Paint one element from a storage path. The element keeps whatever it is
 * already showing until the new URL is known, so a refresh never flashes an
 * empty card. Stale responses (an older request finishing after a newer one)
 * are discarded.
 */
export async function paintPhotoEl(el: El, path?: string | null, force = false): Promise<boolean> {
  const p = path || el.getAttribute("data-img") || el.getAttribute("data-photo-path") || "";
  if (!p) return true;
  const mine = ++seq;
  el.__rdPhotoSeq = mine;

  const url = await photoSrc(p, force);
  if (el.__rdPhotoSeq !== mine) return true; // a newer request already won
  if (!el.isConnected) return true;

  if (!url) {
    if ((el.__rdPhotoTries || 0) < 1) {
      el.__rdPhotoTries = 1;
      return paintPhotoEl(el, p, true);
    }
    failState(el, p);
    return false;
  }

  el.__rdPhotoTries = 0;
  el.classList.remove("rd-img-fail");
  el.querySelector(".rd-img-fail-b")?.remove();
  el.dataset["photoPath"] = p;

  if (el instanceof HTMLImageElement) {
    const img = el as HTMLImageElement & El;
    await new Promise<void>((done) => {
      const probe = new Image();
      probe.onload = () => {
        if (img.__rdPhotoSeq === mine && img.isConnected) img.src = url;
        done();
      };
      probe.onerror = () => {
        log("load failed", { path: p, url: safeUrl(url) });
        done();
      };
      probe.src = url;
    });
    if (img.src !== url) {
      if ((img.__rdPhotoTries || 0) < 1) {
        img.__rdPhotoTries = 1;
        return paintPhotoEl(img, p, true);
      }
      failState(img, p);
      return false;
    }
  } else {
    el.style.backgroundImage = `url("${url}")`;
  }
  el.dataset["painted"] = "1";
  return true;
}

/* One sweeper for the whole app: re-signs any tracked, still-mounted element
   whose URL is about to expire. Nothing else in the card is touched. */
let sweeper: number | null = null;

function sweep() {
  const els = Array.from(
    document.querySelectorAll<El>("img[data-photo-path], [data-img][data-painted]"),
  );
  for (const el of els) {
    const p = el.dataset["photoPath"] || el.getAttribute("data-img") || "";
    if (!p || !isStoredPhoto(p)) continue;
    if (!photoSrcStale(p)) continue;
    log("refreshing before expiry", { path: p });
    void paintPhotoEl(el, p, true);
  }
}

export function startPhotoSweeper() {
  if (sweeper != null || typeof window === "undefined") return;
  sweeper = window.setInterval(sweep, SWEEP_MS);
}

/**
 * Bind every resilient <img> under a root: paint it from its storage path and
 * recover from a load error with one refreshed URL before failing visibly.
 */
export function mountPhotoImages(root: ParentNode | null | undefined) {
  if (!root) return;
  startPhotoSweeper();
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement & El>("img[data-photo-path]"));
  for (const img of imgs) {
    if (img.dataset["photoBound"]) continue;
    img.dataset["photoBound"] = "1";
    const path = img.getAttribute("data-photo-path") || "";
    img.addEventListener("error", () => {
      if ((img.__rdPhotoTries || 0) >= 1) return void failState(img, path);
      img.__rdPhotoTries = 1;
      log("img error, refreshing", { path });
      void paintPhotoEl(img, path, true);
    });
    /* Already showing a valid frame (upload preview or a fresh URL): leave it
       alone, only take over once the cached URL goes stale. */
    if (img.getAttribute("src") && !photoSrcStale(path)) continue;
    void paintPhotoEl(img, path);
  }
}
