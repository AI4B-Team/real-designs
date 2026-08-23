/**
 * The compact "Add More Photos" grid card.
 *
 * The card is intentionally simple: just a "+" icon and a label. It does NOT
 * mirror the photo thumbnail's aspect ratio — that was the old design, and it
 * caused source buttons to clip when the Image Format changed the preview
 * shape. The card keeps a fixed, comfortable shape regardless of format.
 *
 * Clicking (or focusing, or hovering) opens a small anchored popover that lists
 * every available source: Computer, Google Drive, Dropbox, Existing Property
 * Photos, and Media. The host decides which sources are available and what each
 * one does, so the same card serves both Photo Design (all five) and Video
 * Builder (computer + cloud only).
 */

import { DRIVE_ICON, DROPBOX_ICON } from "@/lib/brand-icons";

export type AddSourceId = "computer" | "drive" | "dropbox" | "property" | "media";

type SourceDef = {
  id: AddSourceId;
  label: string;
  icon: string;
  brandIcon?: string;
};

/** Canonical source list. Hosts filter by passing `sources` to mountAddSourceCard. */
const ALL_SOURCES: SourceDef[] = [
  { id: "computer", label: "Computer", icon: "monitor-up" },
  { id: "drive", label: "Google Drive", icon: "", brandIcon: DRIVE_ICON },
  { id: "dropbox", label: "Dropbox", icon: "", brandIcon: DROPBOX_ICON },
  { id: "property", label: "Existing Property", icon: "home" },
  { id: "media", label: "Media", icon: "images" },
];

export type AddSourceCardOptions = {
  /** Files chosen from the computer, or dropped on the card. */
  onComputer: () => void | Promise<void>;
  /** Cloud import for one provider. Omit to hide that button entirely. */
  onCloud?: (provider: "drive" | "dropbox") => void | Promise<void>;
  /** Open the property photo browser. Omit to hide. */
  onProperty?: () => void | Promise<void>;
  /** Open the media browser. Omit to hide. */
  onMedia?: () => void | Promise<void>;
  /** Raw files dropped on the card. Falls back to onComputer when absent. */
  onDrop?: (files: File[]) => void | Promise<void>;
  /** Repaint hook so host frameworks can refresh icons. */
  paint?: () => void;
  /** Which sources to show, in order. Defaults to computer + cloud only. */
  sources?: AddSourceId[];
};

const escHtml = (s: string): string => {
  let out = String(s == null ? "" : s);
  out = out.split("&").join("\u0026amp;");
  out = out.split("<").join("\u0026lt;");
  out = out.split(">").join("\u0026gt;");
  out = out.split('"').join("\u0026quot;");
  return out;
};

/**
 * Card markup. No `ratio` — the card has its own fixed shape that never
 * depends on the photo thumbnail's Image Format. No `pad` — the card is
 * self-contained and doesn't need to align with a photo's footer row.
 */
export function addSourceCardHtml(opts: { id: string; ratio?: string; pad?: boolean }): string {
  const id = opts.id;
  /* ratio and pad are accepted for backward compatibility but ignored. */
  void opts.ratio;
  void opts.pad;
  return `<div class="rv-addcard" data-addcard="${escHtml(id)}">
    <button type="button" class="rv-addcard-face" data-addface
      aria-label="Add More Photos" aria-haspopup="menu" aria-expanded="false">
      <span class="rv-addcard-plus"><i data-lucide="plus"></i></span>
      <b>Add More Photos</b>
    </button>
    <p class="rv-addcard-live" role="status" aria-live="polite" hidden></p>
  </div>`;
}

/* ---- popover ---- */

let openPopover: HTMLElement | null = null;

function closeAddSourcePopover() {
  if (openPopover) {
    const anchor = (openPopover as any).__anchor as HTMLElement | undefined;
    anchor?.setAttribute("aria-expanded", "false");
    openPopover.remove();
    openPopover = null;
  }
}

function openSourcePopover(
  anchor: HTMLElement,
  sources: SourceDef[],
  onSelect: (id: AddSourceId) => void,
  paint?: () => void,
) {
  closeAddSourcePopover();
  const pop = document.createElement("div");
  pop.className = "rds-addpop";
  pop.setAttribute("role", "menu");
  pop.setAttribute("aria-label", "Add Photos From");
  pop.innerHTML = sources
    .map(
      (s, i) =>
        `<button type="button" role="menuitem" class="rds-addpop-i" data-src="${escHtml(
          s.id,
        )}" tabindex="${i === 0 ? "0" : "-1"}">${
          s.brandIcon
            ? `<span class="rds-addpop-i-b">${s.brandIcon}</span>`
            : `<span class="rds-addpop-i-l"><i data-lucide="${escHtml(s.icon)}"></i></span>`
        }<span class="rds-addpop-l">${escHtml(s.label)}</span></button>`,
    )
    .join("");
  document.body.appendChild(pop);
  (pop as any).__anchor = anchor;
  openPopover = pop;
  anchor.setAttribute("aria-expanded", "true");

  /* Position below the anchor, flip up if there's no room. */
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth || 220;
  const ph = pop.offsetHeight || 200;
  const top =
    r.bottom + 8 + ph > window.innerHeight
      ? Math.max(12, r.top - ph - 8)
      : r.bottom + 8;
  pop.style.top = top + "px";
  pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - pw - 12)) + "px";

  paint?.();

  const items = Array.from(pop.querySelectorAll<HTMLElement>("[data-src]"));
  items.forEach((b, i) => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-src") as AddSourceId;
      closeAddSourcePopover();
      onSelect(id);
    });
    b.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n =
          (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[n]?.focus();
      }
      if (e.key === "Escape") {
        closeAddSourcePopover();
        anchor?.focus();
      }
    });
  });
  items[0]?.focus();

  /* Click-away to close. Deferred so the opening click doesn't close it. */
  setTimeout(() => {
    const away = (e: MouseEvent) => {
      if (openPopover && !openPopover.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
        closeAddSourcePopover();
        document.removeEventListener("mousedown", away);
      }
    };
    document.addEventListener("mousedown", away);
  }, 0);

  return pop;
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

  const face = card.querySelector<HTMLElement>("[data-addface]");
  const live = card.querySelector<HTMLElement>(".rv-addcard-live");

  /* Resolve which sources to show based on which callbacks are present. */
  const requested = opts.sources ?? ["computer", "drive", "dropbox"];
  const sources = ALL_SOURCES.filter((s) => {
    if (s.id === "computer") return true;
    if (s.id === "drive" || s.id === "dropbox") return !!opts.onCloud && requested.includes(s.id);
    if (s.id === "property") return !!opts.onProperty && requested.includes(s.id);
    if (s.id === "media") return !!opts.onMedia && requested.includes(s.id);
    return false;
  });

  const say = (msg: string) => {
    if (!live) return;
    live.hidden = !msg;
    live.textContent = msg;
  };

  const handleSelect = async (id: AddSourceId) => {
    say(id === "computer" ? "Opening Your Files" : "Opening The Import Window");
    try {
      if (id === "computer") await opts.onComputer();
      else if (id === "drive") await opts.onCloud?.("drive");
      else if (id === "dropbox") await opts.onCloud?.("dropbox");
      else if (id === "property") await opts.onProperty?.();
      else if (id === "media") await opts.onMedia?.();
    } finally {
      say("");
    }
  };

  face?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (openPopover && (openPopover as any).__anchor === face) {
      closeAddSourcePopover();
      return;
    }
    const first = sources[0];
    if (first) {
      /* Only one source: skip the menu and go straight to it. */
      void handleSelect(first.id);
      return;
    }
    openSourcePopover(
      face!,
      sources,
      (id) => void handleSelect(id),
      opts.paint,
    );
  });

  /* Keyboard: Enter/Space already handled by the button, but also support
     opening with arrow-down to match native menu semantics. */
  face?.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" && !openPopover) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).click();
    }
  });

  /* Dropping on the card is the same intake as choosing Computer. */
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
}

/** Legacy export — no-ops the old expand/collapse checks. */
export function isAddSourceCardOpen(_card: HTMLElement): boolean {
  return false;
}
