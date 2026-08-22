/**
 * The compact "Add More Photos" grid card.
 *
 * This card is NOT a general source browser. It adds new files only, from the
 * three places files actually come from: the computer, Google Drive and
 * Dropbox. Property and Media stay in the top-level Studio source picker.
 *
 * Everything happens inside the card itself — there is no floating popover and
 * no second modal shell here. The card keeps the photo cards' exact box, so
 * expanding it never resizes the tile, never reflows the grid and never lets a
 * label escape its own boundary.
 */

import { DRIVE_ICON, DROPBOX_ICON } from "@/lib/brand-icons";
import { providerAvailable } from "@/lib/provider-import";

export type AddSourceId = "computer" | "drive" | "dropbox";

export type AddSourceCardOptions = {
  /** Files chosen from the computer, or dropped on the card. */
  onComputer: () => void | Promise<void>;
  /** Cloud import for one provider. Omit to hide that button entirely. */
  onCloud?: (provider: "drive" | "dropbox") => void | Promise<void>;
  /** Raw files dropped on the card. Falls back to onComputer when absent. */
  onDrop?: (files: File[]) => void | Promise<void>;
  /** Repaint hook so host frameworks can refresh icons. */
  paint?: () => void;
};

/** Every mounted card, so only one can ever be expanded. */
const MOUNTED = new Set<HTMLElement>();

/** A provider button ships only when its import path is real. */
export function cloudSourceEnabled(id: "drive" | "dropbox"): boolean {
  return providerAvailable(id);
}


/**
 * Card markup. `ratio` is the grid's aspect-ratio class so the action card is
 * exactly the same shape as the photo cards beside it.
 */
export function addSourceCardHtml(opts: {
  id: string;
  ratio?: string;
  /** Reserves the photo cards' footer row so the frames stay aligned. */
  pad?: boolean;
}): string {
  const id = opts.id;
  const panelId = id + "Sources";
  const cloud = (
    key: "drive" | "dropbox",
    label: string,
    icon: string,
  ) =>
    cloudSourceEnabled(key)
      ? `<button type="button" class="rv-addsrc rv-addsrc-${key}" data-addsrc="${key}" tabindex="-1">
        <span class="rv-addsrc-i">${icon}</span><span class="rv-addsrc-l">${label}</span>
        <span class="rv-addsrc-sp" hidden aria-hidden="true"></span>
      </button>`
      : "";
  return `<div class="rv-addcard ${opts.ratio || ""}" data-addcard="${id}">
    <div class="rv-addcard-b" id="${id}">
      <button type="button" class="rv-addcard-face" data-addface
        aria-label="Add More Photos" aria-expanded="false" aria-controls="${panelId}">
        <i data-lucide="plus"></i>
        <b>Add More Photos</b>
      </button>
      <div class="rv-addcard-src" id="${panelId}" role="group" aria-label="Add Photos From" hidden>
        <button type="button" class="rv-addsrc rv-addsrc-computer" data-addsrc="computer" tabindex="-1">
          <span class="rv-addsrc-i"><i data-lucide="monitor-up"></i></span><span class="rv-addsrc-l">Computer</span>
          <span class="rv-addsrc-sp" hidden aria-hidden="true"></span>
        </button>
        ${cloud("drive", "Google Drive", DRIVE_ICON)}
        ${cloud("dropbox", "Dropbox", DROPBOX_ICON)}
      </div>
    </div>
    ${opts.pad ? '<div class="rv-addcard-pad" aria-hidden="true"></div>' : ""}
    <p class="rv-addcard-live" role="status" aria-live="polite" hidden></p>
  </div>`;
}

function collapse(card: HTMLElement) {
  card.classList.remove("open");
  const face = card.querySelector<HTMLElement>("[data-addface]");
  const panel = card.querySelector<HTMLElement>(".rv-addcard-src");
  if (panel) panel.hidden = true;
  face?.setAttribute("aria-expanded", "false");
}

function expand(card: HTMLElement) {
  MOUNTED.forEach((c) => {
    if (c !== card) collapse(c);
  });
  card.classList.add("open");
  const panel = card.querySelector<HTMLElement>(".rv-addcard-src");
  if (panel) panel.hidden = false;
  card.querySelector<HTMLElement>("[data-addface]")?.setAttribute("aria-expanded", "true");
}

export function isAddSourceCardOpen(card: HTMLElement): boolean {
  return card.classList.contains("open");
}

/**
 * Wires one card. Safe to call after every re-render: the card element is new
 * each time, so state lives on the element, never in a module-level singleton.
 */
export function mountAddSourceCard(
  card: HTMLElement | null,
  opts: AddSourceCardOptions,
): void {
  if (!card || (card as any).__rdAddCard) return;
  (card as any).__rdAddCard = true;
  MOUNTED.forEach((c) => {
    if (!c.isConnected) MOUNTED.delete(c);
  });
  MOUNTED.add(card);

  const face = card.querySelector<HTMLElement>("[data-addface]");
  const live = card.querySelector<HTMLElement>(".rv-addcard-live");
  const buttons = () => Array.from(card.querySelectorAll<HTMLElement>("[data-addsrc]"));
  let hoverTimer: any = null;
  let locked = false;

  const say = (msg: string) => {
    if (!live) return;
    live.hidden = !msg;
    live.textContent = msg;
  };

  const open = (lock: boolean) => {
    if (lock) locked = true;
    expand(card);
    opts.paint?.();
  };
  const close = () => {
    locked = false;
    clearTimeout(hoverTimer);
    collapse(card);
  };

  face?.addEventListener("click", () => {
    if (isAddSourceCardOpen(card) && locked) {
      close();
      return;
    }
    open(true);
    buttons()[0]?.focus();
  });

  /* Hover only previews; it may never steal a locked-open card away. */
  card.addEventListener("mouseenter", () => {
    if (locked) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => open(false), 260);
  });
  card.addEventListener("mouseleave", () => {
    clearTimeout(hoverTimer);
    if (!locked) collapse(card);
  });

  card.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape" && isAddSourceCardOpen(card)) {
      e.stopPropagation();
      close();
      face?.focus();
      return;
    }
    const list = buttons();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && i >= 0) {
      e.preventDefault();
      const n = (i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
      list[n]?.focus();
    }
  });

  /* Choosing a source: a spinner in that button, and no double launches. */
  card.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement)?.closest?.("[data-addsrc]") as HTMLElement | null;
    if (!btn || !card.contains(btn)) return;
    e.preventDefault();
    if (btn.hasAttribute("data-busy")) return;
    const id = btn.getAttribute("data-addsrc") as AddSourceId;
    btn.setAttribute("data-busy", "1");
    const sp = btn.querySelector<HTMLElement>(".rv-addsrc-sp");
    if (sp) sp.hidden = false;
    say(id === "computer" ? "Opening Your Files" : "Opening The Import Window");
    try {
      if (id === "computer") await opts.onComputer();
      else await opts.onCloud?.(id);
    } finally {
      btn.removeAttribute("data-busy");
      if (sp) sp.hidden = true;
      say("");
      /* Focus returns to the card once a source workflow hands back. */
      close();
      face?.focus();
    }
  });

  /* Dropping on the collapsed or the expanded card is the same intake. */
  const stop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  card.addEventListener("dragover", (e) => {
    stop(e as DragEvent);
    card.classList.add("drop");
  });
  card.addEventListener("dragleave", () => card.classList.remove("drop"));
  card.addEventListener("drop", async (e) => {
    stop(e as DragEvent);
    card.classList.remove("drop");
    const files = Array.from((e as DragEvent).dataTransfer?.files || []);
    if (!files.length) return;
    if (opts.onDrop) await opts.onDrop(files);
    else await opts.onComputer();
  });

  const away = (e: Event) => {
    if (!card.isConnected) {
      document.removeEventListener("mousedown", away);
      MOUNTED.delete(card);
      return;
    }
    if (!card.contains(e.target as Node)) close();
  };
  document.addEventListener("mousedown", away);
}
