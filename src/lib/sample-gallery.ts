/**
 * Homepage sample gallery.
 *
 * The builder's "No Photo Handy?" thumbnails are too small to judge, so each
 * one opens this preview modal. The modal never mutates selection on its own:
 * it reports the previewed sample back through `onSelect` only when the visitor
 * presses "Use This Sample", so the existing builder workflow stays the single
 * source of truth.
 */
import { PHOTOS } from "@/content/rd-photos";

export type SampleItem = {
  /** Index in the builder's existing sample order (data-s). */
  index: number;
  name: string;
  room: string;
  src: string;
  alt: string;
};

export const HERO_SAMPLES: SampleItem[] = [
  {
    index: 0,
    name: "Original Living Room",
    room: "Living Room · As Found",
    src: PHOTOS.before,
    alt: "Dated living room before any redesign, used as a sample space",
  },
  {
    index: 1,
    name: "Coastal Living Room",
    room: "Living Room · Coastal",
    src: PHOTOS.coastal,
    alt: "Living room redesigned in a light coastal direction",
  },
  {
    index: 2,
    name: "Farmhouse Living Room",
    room: "Living Room · Modern Farmhouse",
    src: PHOTOS.farmhouse,
    alt: "Living room redesigned in a modern farmhouse direction",
  },
  {
    index: 3,
    name: "Japandi Living Room",
    room: "Living Room · Japandi",
    src: PHOTOS.japandi,
    alt: "Living room redesigned in a calm Japandi direction",
  },
];

/** Wrapping index helper: next past the end returns to the start. */
export function wrapIndex(i: number, len: number): number {
  if (len <= 0) return 0;
  return ((i % len) + len) % len;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export type GalleryOptions = {
  /** Sample to show first. */
  start: number;
  /** Currently selected sample in the builder. */
  selected: number;
  samples?: SampleItem[];
  /** Called with the sample index when the visitor confirms. */
  onSelect: (index: number) => void;
  /** Element that opened the modal; focus returns here on close. */
  opener?: HTMLElement | null;
  /** Where to mount; defaults to the site root. */
  root?: HTMLElement | null;
};

/** Opens the preview modal. Every call builds and tears down its own listeners. */
export function openSampleGallery(opts: GalleryOptions): () => void {
  const items = opts.samples ?? HERO_SAMPLES;
  if (!items.length) return () => {};
  const host = opts.root ?? document.querySelector(".rd-site") ?? document.body;
  const opener = opts.opener ?? null;
  let cur = wrapIndex(opts.start, items.length);

  const el = document.createElement("div");
  el.className = "rdsg";
  el.innerHTML = `
  <div class="rdsg-scrim" data-close></div>
  <div class="rdsg-card" role="dialog" aria-modal="true" aria-labelledby="rdsg-title">
    <div class="rdsg-head">
      <div>
        <h3 id="rdsg-title" class="rdsg-name"></h3>
        <p class="rdsg-room mono"></p>
      </div>
      <button type="button" class="rdsg-x" data-close aria-label="Close Preview">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="rdsg-stage">
      <button type="button" class="rdsg-arrow rdsg-prev" aria-label="Previous Sample">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
      </button>
      <div class="rdsg-frame"><img class="rdsg-img" alt=""><span class="rdsg-fallback">This Sample Could Not Be Loaded</span></div>
      <button type="button" class="rdsg-arrow rdsg-next" aria-label="Next Sample">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>
    <p class="rdsg-pos mono" aria-live="polite"></p>
    <div class="rdsg-strip" role="tablist" aria-label="All Samples"></div>
    <div class="rdsg-foot">
      <button type="button" class="btn btn-ghost rdsg-cancel" data-close>Cancel</button>
      <button type="button" class="btn btn-primary rdsg-use">Use This Sample</button>
    </div>
  </div>`;
  host.appendChild(el);

  const card = el.querySelector(".rdsg-card") as HTMLElement;
  const img = el.querySelector(".rdsg-img") as HTMLImageElement;
  const frame = el.querySelector(".rdsg-frame") as HTMLElement;
  const nameEl = el.querySelector(".rdsg-name") as HTMLElement;
  const roomEl = el.querySelector(".rdsg-room") as HTMLElement;
  const posEl = el.querySelector(".rdsg-pos") as HTMLElement;
  const strip = el.querySelector(".rdsg-strip") as HTMLElement;
  const useBtn = el.querySelector(".rdsg-use") as HTMLButtonElement;

  strip.innerHTML = items
    .map(
      (s, i) =>
        `<button type="button" class="rdsg-thumb" role="tab" data-i="${i}" aria-label="Preview ${s.name}"><img src="${s.src}" alt="" loading="lazy"></button>`,
    )
    .join("");
  const thumbs = Array.from(strip.querySelectorAll<HTMLButtonElement>(".rdsg-thumb"));

  const preload = (i: number) => {
    const s = items[wrapIndex(i, items.length)];
    if (!s) return;
    const p = new Image();
    p.src = s.src;
  };

  function paint() {
    const s = items[cur]!;
    frame.classList.remove("failed");
    img.alt = s.alt;
    img.src = s.src;
    nameEl.textContent = s.name;
    roomEl.textContent = s.room;
    posEl.textContent = `${cur + 1} Of ${items.length}`;
    thumbs.forEach((t, i) => {
      t.classList.toggle("on", i === cur);
      t.setAttribute("aria-selected", i === cur ? "true" : "false");
    });
    const isSelected = items[cur]!.index === opts.selected;
    useBtn.textContent = isSelected ? "Selected" : "Use This Sample";
    useBtn.classList.toggle("is-selected", isSelected);
    preload(cur + 1);
    preload(cur - 1);
  }

  img.addEventListener("error", () => frame.classList.add("failed"));

  function go(delta: number) {
    cur = wrapIndex(cur + delta, items.length);
    paint();
  }

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey, true);
    el.remove();
    document.body.style.overflow = prevOverflow;
    if (opener && document.contains(opener)) opener.focus();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
      return;
    }
    if (e.key === "Tab") {
      const f = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  el.querySelectorAll("[data-close]").forEach((n) => n.addEventListener("click", close));
  (el.querySelector(".rdsg-prev") as HTMLElement).addEventListener("click", () => go(-1));
  (el.querySelector(".rdsg-next") as HTMLElement).addEventListener("click", () => go(1));
  thumbs.forEach((t, i) =>
    t.addEventListener("click", () => {
      cur = i;
      paint();
    }),
  );
  useBtn.addEventListener("click", () => {
    const s = items[cur]!;
    close();
    opts.onSelect(s.index);
  });

  // Swipe on touch devices.
  let sx = 0;
  let sy = 0;
  frame.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      sx = t.clientX;
      sy = t.clientY;
    },
    { passive: true },
  );
  frame.addEventListener(
    "touchend",
    (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );

  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onKey, true);
  paint();
  requestAnimationFrame(() => useBtn.focus());

  return close;
}
