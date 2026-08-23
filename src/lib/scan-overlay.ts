/**
 * Design scan overlay.
 *
 * The source photograph is never replaced by a skeleton or a spinner: this is
 * a separate absolutely positioned layer placed over the image, so the image
 * element is never re-created, moved, resized or reloaded while it runs. The
 * overlay animates opacity and transform only, so no layout is animated and
 * no Canvas geometry can shift.
 *
 * Everything it says comes from the job store — the overlay itself never
 * guesses a stage, invents a percentage or claims to have detected an object.
 */

import {
  STAGE_NOTE,
  STAGE_TITLE,
  isTerminal,
  progressText,
  type Stage,
} from "@/lib/generation-jobs";

export type ScanOverlay = {
  el: HTMLElement;
  /** Show a stage. Detail overrides the generic note (e.g. the chosen style). */
  setStage: (stage: Stage, detail?: string) => void;
  /** One-shot reveal, then the overlay removes itself. */
  complete: (opts?: { onRevealed?: () => void }) => void;
  fail: (message: string) => void;
  destroy: () => void;
  reducedMotion: boolean;
};

export function prefersReducedMotion(): boolean {
  try {
    return !!(
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

/** Reveal duration, inside the 600-900ms the design calls for. */
export const REVEAL_MS = 750;

const MARKUP = `
  <div class="rd-scan-dim" aria-hidden="true"></div>
  <div class="rd-scan-grid" aria-hidden="true"></div>
  <div class="rd-scan-marks" aria-hidden="true">
    <i class="m tl"></i><i class="m tr"></i><i class="m bl"></i><i class="m br"></i>
    <i class="edge x"></i><i class="edge y"></i>
  </div>
  <div class="rd-scan-line" aria-hidden="true"></div>
  <div class="rd-scan-reveal" aria-hidden="true"></div>
  <div class="rd-scan-pill" role="status" aria-live="polite">
    <b class="rd-scan-title"></b>
    <span class="rd-scan-note"></span>
    <span class="rd-scan-step"></span>
  </div>`;

/**
 * Mount over `host`. The host keeps its own size; the overlay is absolute, so
 * mounting and unmounting cannot change the layout around the image.
 */
export function mountScanOverlay(
  host: HTMLElement,
  opts: { stage?: Stage; detail?: string; reducedMotion?: boolean } = {},
): ScanOverlay {
  const doc = host.ownerDocument || document;
  const existing = host.querySelector(":scope > .rd-scan");
  if (existing) existing.remove();

  const reduced = opts.reducedMotion ?? prefersReducedMotion();
  const el = doc.createElement("div");
  el.className = "rd-scan" + (reduced ? " rd-scan--static" : "");
  el.setAttribute("data-rd-scan", "1");
  el.innerHTML = MARKUP;

  /* The host is the positioning context; it is never resized by the overlay. */
  try {
    const pos = doc.defaultView?.getComputedStyle(host).position;
    if (!pos || pos === "static") host.style.position = "relative";
  } catch {
    /* jsdom without layout: the CSS class still positions the overlay. */
  }
  host.appendChild(el);

  const titleEl = el.querySelector(".rd-scan-title") as HTMLElement;
  const noteEl = el.querySelector(".rd-scan-note") as HTMLElement;
  const stepEl = el.querySelector(".rd-scan-step") as HTMLElement;

  let destroyed = false;
  let revealed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  /* Off-screen work is wasted work: pause while the tab is hidden. */
  const onVisibility = () => {
    if (destroyed) return;
    el.classList.toggle("rd-scan--paused", doc.visibilityState === "hidden");
  };
  doc.addEventListener("visibilitychange", onVisibility);
  onVisibility();

  const setStage = (stage: Stage, detail?: string) => {
    if (destroyed) return;
    el.setAttribute("data-stage", stage);
    titleEl.textContent = STAGE_TITLE[stage] || "";
    noteEl.textContent = detail || STAGE_NOTE[stage] || "";
    stepEl.textContent = progressText({ stage });
    /* Motion belongs to working stages only. */
    el.classList.toggle("rd-scan--still", isTerminal(stage));
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (timer) clearTimeout(timer);
    timer = null;
    doc.removeEventListener("visibilitychange", onVisibility);
    el.remove();
  };

  const complete: ScanOverlay["complete"] = (o = {}) => {
    if (destroyed) return;
    setStage("complete");
    if (revealed) return; /* The completed image is never re-animated. */
    revealed = true;
    if (reduced) {
      o.onRevealed && o.onRevealed();
      destroy();
      return;
    }
    el.classList.add("rd-scan--reveal");
    timer = setTimeout(() => {
      o.onRevealed && o.onRevealed();
      destroy();
    }, REVEAL_MS);
  };

  const fail = (message: string) => {
    if (destroyed) return;
    setStage("failed", message);
    el.classList.add("rd-scan--failed");
  };

  setStage(opts.stage || "queued", opts.detail);

  return { el, setStage, complete, fail, destroy, reducedMotion: reduced };
}

/** Remove any overlay under `host`, whatever mounted it. */
export function clearScanOverlay(host: HTMLElement | null): void {
  if (!host) return;
  host.querySelectorAll(".rd-scan").forEach((n) => n.remove());
}
