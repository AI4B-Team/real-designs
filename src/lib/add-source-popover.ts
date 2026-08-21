/**
 * The compact "where do these photos come from?" popover.
 *
 * The Add More Photos card is a card, not a toolbar: clicking it opens this
 * small anchored menu instead of cramming four source buttons into the tile.
 * Choosing Computer goes straight to the file dialog; every other source
 * opens the one shared source picker in a modal, on the matching tab.
 */
/* eslint-disable */
// @ts-nocheck

import { mountSourcePicker, type SourceId } from "@/lib/source-picker";

export type AddSource = "computer" | "cloud" | "property" | "media" | "url";

const SOURCE_LIST: Array<{ id: AddSource; label: string; icon: string; tab?: SourceId }> = [
  { id: "computer", label: "Computer", icon: "upload" },
  { id: "cloud", label: "Google Drive", icon: "cloud", tab: "cloud" },
  { id: "property", label: "Existing Property", icon: "home", tab: "property" },
  { id: "media", label: "Media", icon: "images", tab: "design" },
  { id: "url", label: "Listing Link", icon: "link", tab: "url" },
];

const escHtml = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

let openPop = null;

export function closeAddSourcePopover() {
  if (openPop) {
    const anchor = openPop.__anchor;
    if (anchor && anchor.setAttribute) anchor.setAttribute("aria-expanded", "false");
    openPop.remove();
    openPop = null;
  }
}

export function sourceTabFor(id: AddSource): SourceId | null {
  return SOURCE_LIST.find((s) => s.id === id)?.tab || null;
}

/**
 * Anchored source menu. `sources` names which entries appear, in order, so a
 * workflow that cannot import a listing link simply never offers one.
 */
export function openAddSourcePopover(anchor, opts) {
  closeAddSourcePopover();
  const allowed = (opts && opts.sources) || ["computer", "cloud", "property", "media"];
  const list = SOURCE_LIST.filter((s) => allowed.includes(s.id));
  const pop = document.createElement("div");
  pop.className = "rds-srcpop";
  pop.setAttribute("role", "menu");
  pop.setAttribute("aria-label", "Add Photos From");
  pop.innerHTML = list
    .map(
      (s) =>
        `<button type="button" role="menuitem" class="rds-srcpop-i" data-src="${s.id}"><i data-lucide="${s.icon}"></i><span>${escHtml(s.label)}</span></button>`,
    )
    .join("");
  document.body.appendChild(pop);
  pop.__anchor = anchor;
  openPop = pop;
  if (anchor && anchor.setAttribute) {
    anchor.setAttribute("aria-expanded", "true");
    anchor.setAttribute("aria-haspopup", "menu");
  }
  const r = anchor.getBoundingClientRect();
  const h = pop.offsetHeight || 200;
  const top = r.bottom + 8 + h > window.innerHeight ? Math.max(12, r.top - h - 8) : r.bottom + 8;
  pop.style.top = top + "px";
  pop.style.left =
    Math.max(12, Math.min(r.left, window.innerWidth - (pop.offsetWidth || 220) - 12)) + "px";
  opts?.paint?.();

  const items = Array.from(pop.querySelectorAll("[data-src]"));
  items.forEach((b, i) => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-src");
      closeAddSourcePopover();
      opts?.onSelect?.(id);
    });
    b.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[n].focus();
      }
      if (e.key === "Escape") {
        closeAddSourcePopover();
        anchor?.focus?.();
      }
    });
  });
  items[0]?.focus();
  setTimeout(() => {
    const away = (e) => {
      if (openPop && !openPop.contains(e.target)) {
        closeAddSourcePopover();
        document.removeEventListener("mousedown", away);
      }
    };
    document.addEventListener("mousedown", away);
  }, 0);
  return pop;
}

/**
 * The shared source picker in a modal, opened on one tab. Used for every
 * source that needs more than a file dialog.
 */
export function openSourceModal(opts) {
  const wrap = document.createElement("div");
  wrap.className = "rds-srcmodal";
  wrap.innerHTML = `<div class="rds-srcmodal-in" role="dialog" aria-modal="true" aria-label="${escHtml(opts.title || "Add Photos")}">
    <div class="rds-srcmodal-h">
      <h3>${escHtml(opts.title || "Add Photos")}</h3>
      <button type="button" class="icon-btn sm" data-close aria-label="Close"><i data-lucide="x"></i></button>
    </div>
    <div class="rds-srcmodal-b"></div>
  </div>`;
  document.body.appendChild(wrap);
  const close = () => {
    try {
      picker?.destroy?.();
    } catch (_) {}
    wrap.remove();
  };
  const slot = wrap.querySelector(".rds-srcmodal-b");
  const picker = mountSourcePicker(slot, {
    ...opts.picker,
    onPick: async (picked) => {
      close();
      await opts.picker?.onPick?.(picked);
    },
    ...(opts.picker?.onPropertyPhotos
      ? {
          onPropertyPhotos: async (p, photos) => {
            close();
            await opts.picker.onPropertyPhotos(p, photos);
          },
        }
      : {}),
    ...(opts.picker?.onDesigns
      ? {
          onDesigns: async (designs) => {
            close();
            await opts.picker.onDesigns(designs);
          },
        }
      : {}),
  });
  opts.paint?.();
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || e.target.closest("[data-close]")) close();
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  wrap.querySelector("[data-close]")?.focus();
  return { close };
}
