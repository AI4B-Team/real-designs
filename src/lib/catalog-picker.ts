import { createIcons, icons as lucideIcons } from "lucide";
/**
 * CatalogPickerModal — one shell for every "browse a finite catalog and pick
 * something" modal in the app: rooms and areas, design styles, media,
 * properties, reference images.
 *
 * The shell owns the chrome so no workflow has to reinvent it: overlay,
 * header, search, optional category chips, a responsive preview-card grid,
 * empty state, footer with the current selection, Cancel and Apply Selection.
 *
 * Rules the shell guarantees:
 * - Selecting a card never commits. Only Apply commits.
 * - Cancel, Escape, backdrop and Close restore the original selection.
 * - Focus moves into the modal, is trapped, and returns to the opener.
 * - Only one picker with the same key can be open, and reopening never leaves
 *   stale listeners behind because every listener lives on the removed node.
 */

export type CatalogItem = {
  /** Stable id. Labels are display values only. */
  id: string;
  label: string;
  description?: string;
  /** Preview image URL. Falls back to the icon when missing or broken. */
  image?: string | null;
  icon?: string;
  badge?: string;
  category?: string;
  /** Extra words the search should match. */
  terms?: string[];
  disabled?: boolean;
};

export type CatalogPickerOptions = {
  /** Identifies this picker so a second open replaces the first. */
  key: string;
  title: string;
  description?: string;
  items: CatalogItem[];
  categories?: string[];
  /** Ids selected when the modal opens. */
  selected?: string[];
  multiple?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  applyLabel?: string;
  cancelLabel?: string;
  /** Optional workflow-only choices rendered under the grid (Unassigned…). */
  extras?: CatalogItem[];
  /** Offer a free-text option built from the search query. */
  allowCustom?: boolean;
  customHint?: (query: string) => string;
  /** Element focus returns to. Defaults to document.activeElement. */
  opener?: HTMLElement | null;
  onApply: (ids: string[], items: CatalogItem[]) => void;
  onCancel?: () => void;
  /** Optional custom-value callback for allowCustom pickers. */
  onCustom?: (label: string) => void;
};

const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

function paintIcons(root: HTMLElement) {
  try {
    createIcons({ icons: lucideIcons, root });
  } catch (_) {
    /* icons are cosmetic */
  }
}

const FOCUSABLE =
  'button:not([disabled]),input:not([disabled]),select,textarea,[href],[tabindex]:not([tabindex="-1"])';

export type CatalogPickerHandle = { close: () => void; el: HTMLElement };

const open = new Map<string, CatalogPickerHandle>();

/** True when a picker with this key is on screen. Used to avoid stacking. */
export function isCatalogPickerOpen(key: string): boolean {
  return open.has(key);
}

export function closeCatalogPicker(key: string) {
  open.get(key)?.close();
}

export function openCatalogPicker(o: CatalogPickerOptions): CatalogPickerHandle {
  /* One instance per key: never stack a picker over itself. */
  open.get(o.key)?.close();

  const host = (document.querySelector(".rd-app") || document.body) as HTMLElement;
  const opener =
    o.opener || (document.activeElement instanceof HTMLElement ? document.activeElement : null);

  let picked: string[] = (o.selected || []).filter(Boolean);
  let query = "";
  let category = o.categories && o.categories.length ? o.categories[0]! : "";

  const m = document.createElement("div");
  m.className = "up-modal cs-modal rdcat on";
  m.dataset["picker"] = o.key;
  const titleId = "cat-title-" + Math.random().toString(36).slice(2, 8);
  const descId = titleId + "-d";

  m.innerHTML =
    '<div class="up-scrim" data-close></div>' +
    '<div class="up-card cs-card" role="dialog" aria-modal="true" aria-labelledby="' +
    titleId +
    (o.description ? '" aria-describedby="' + descId : "") +
    '">' +
    '<div class="cs-head"><div><h3 id="' +
    titleId +
    '">' +
    esc(o.title) +
    "</h3>" +
    (o.description ? '<p id="' + descId + '">' + esc(o.description) + "</p>" : "") +
    "</div>" +
    '<button class="icon-btn" type="button" data-close aria-label="Close"><i data-lucide="x"></i></button></div>' +
    '<div class="cs-filters"><div class="cs-search"><i data-lucide="search"></i>' +
    '<input data-q type="search" placeholder="' +
    esc(o.searchPlaceholder || "Search") +
    '" aria-label="' +
    esc(o.searchPlaceholder || "Search") +
    '"></div>' +
    (o.categories && o.categories.length > 1
      ? '<div class="cs-cats">' +
        o.categories
          .map(
            (c, i) =>
              '<button class="chip' +
              (i === 0 ? " on" : "") +
              '" type="button" data-cat="' +
              esc(c) +
              '">' +
              esc(c) +
              "</button>",
          )
          .join("") +
        "</div>"
      : "") +
    "</div>" +
    '<div class="cs-grid" data-grid role="listbox" aria-label="' +
    esc(o.title) +
    '"' +
    (o.multiple ? ' aria-multiselectable="true"' : "") +
    "></div>" +
    '<div class="cs-extras" data-extras hidden></div>' +
    '<div class="cs-foot"><span class="cs-foot-note" data-note></span>' +
    '<div class="cs-foot-act"><button class="btn btn-dark" type="button" data-close>' +
    esc(o.cancelLabel || "Cancel") +
    "</button>" +
    '<button class="btn btn-primary" type="button" data-use disabled>' +
    esc(o.applyLabel || "Apply Selection") +
    "</button></div></div>" +
    "</div>";

  host.appendChild(m);

  const grid = m.querySelector("[data-grid]") as HTMLElement;
  const extrasBox = m.querySelector("[data-extras]") as HTMLElement;
  const useBtn = m.querySelector("[data-use]") as HTMLButtonElement;
  const note = m.querySelector("[data-note]") as HTMLElement;
  const search = m.querySelector("[data-q]") as HTMLInputElement;

  const all = () => o.items.concat(o.extras || []);
  const byId = (id: string) => all().find((i) => i.id === id) || null;

  function matches(it: CatalogItem, q: string) {
    if (!q) return true;
    return [it.label, it.description || "", ...(it.terms || [])]
      .join(" ")
      .toLowerCase()
      .includes(q);
  }

  function visible(): CatalogItem[] {
    const q = query.trim().toLowerCase();
    let list = o.items;
    if (category && o.categories && o.categories.length > 1 && category !== o.categories[0])
      list = list.filter((i) => i.category === category);
    return list.filter((i) => matches(i, q));
  }

  function tile(it: CatalogItem, cls = "cs-tile") {
    const on = picked.includes(it.id);
    return (
      '<button class="' +
      cls +
      (on ? " on" : "") +
      '" type="button" role="option" aria-selected="' +
      (on ? "true" : "false") +
      '" data-pick="' +
      esc(it.id) +
      '" title="' +
      Esc(it.label) +
      '">' +
      '<span class="cs-th">' +
      (it.image
        ? '<img loading="lazy" src="' +
          esc(it.image) +
          '" alt="' +
          esc(it.label) +
          '" onerror="this.remove()">'
        : '<i data-lucide="' + esc(it.icon || "image") + '"></i>') +
      (on ? '<span class="cs-tick"><i data-lucide="check"></i></span>' : "") +
      (it.badge ? '<span class="cs-lock">' + esc(it.badge) + "</span>" : "") +
      "</span>" +
      '<span class="cs-tn">' +
      esc(it.label) +
      "</span>" +
      (it.description ? '<span class="cs-td">' + esc(it.description) + "</span>" : "") +
      "</button>"
    );
  }

  function summary() {
    if (!picked.length) return "Choose an option to continue.";
    const labels = picked.map((id) => byId(id)?.label || id);
    return "Selected: " + labels.join(", ");
  }

  function paint() {
    const list = visible();
    const q = query.trim();
    const custom =
      o.allowCustom && q && !all().some((i) => i.label.toLowerCase() === q.toLowerCase());
    grid.innerHTML = list.length
      ? list.map((i) => tile(i)).join("")
      : custom
        ? ""
        : '<div class="cs-empty">' +
          esc(o.emptyText || "Nothing matches that search. Try a different word.") +
          "</div>";
    if (custom)
      grid.insertAdjacentHTML(
        "afterbegin",
        '<button class="cs-tile cs-custom" type="button" data-custom><span class="cs-th"><i data-lucide="plus"></i></span>' +
          '<span class="cs-tn">' +
          esc(o.customHint ? o.customHint(q) : 'Use "' + q + '"') +
          "</span></button>",
      );

    const extras = (o.extras || []).filter((i) => matches(i, q.toLowerCase()));
    extrasBox.hidden = !extras.length;
    extrasBox.innerHTML = extras.map((i) => tile(i, "cs-extra")).join("");

    useBtn.disabled = !picked.length;
    note.textContent = summary();
    paintIcons(m);
  }

  let done = false;
  function close(cancelled: boolean) {
    if (done) return;
    done = true;
    open.delete(o.key);
    document.removeEventListener("keydown", onKey, true);
    m.remove();
    try {
      opener?.focus();
    } catch (_) {}
    if (cancelled) o.onCancel?.();
  }

  function apply() {
    if (!picked.length) return;
    const ids = picked.slice();
    const items = ids.map((id) => byId(id)).filter(Boolean) as CatalogItem[];
    close(false);
    o.onApply(ids, items);
  }

  function onKey(e: KeyboardEvent) {
    if (!document.body.contains(m)) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = Array.from(m.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (n) => n.offsetParent !== null || n === document.activeElement,
    );
    if (!nodes.length) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  document.addEventListener("keydown", onKey, true);

  m.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (!t || !t.closest) return;
    if (t.closest("[data-close]")) {
      e.preventDefault();
      close(true);
      return;
    }
    if (t.closest("[data-custom]")) {
      e.preventDefault();
      const label = query.trim();
      if (!label) return;
      close(false);
      o.onCustom?.(label);
      return;
    }
    const cat = t.closest("[data-cat]") as HTMLElement | null;
    if (cat) {
      category = cat.dataset["cat"] || "";
      m.querySelectorAll("[data-cat]").forEach((c) => c.classList.toggle("on", c === cat));
      paint();
      return;
    }
    const card = t.closest("[data-pick]") as HTMLElement | null;
    if (card) {
      const id = card.dataset["pick"] || "";
      if (o.multiple) picked = picked.includes(id) ? picked.filter((x) => x !== id) : picked.concat(id);
      else picked = [id];
      paint();
      return;
    }
    if (t.closest("[data-use]")) {
      e.preventDefault();
      apply();
    }
  });

  /* Double-click applies. A single click only selects. */
  m.addEventListener("dblclick", (e) => {
    const card = (e.target as HTMLElement)?.closest?.("[data-pick]") as HTMLElement | null;
    if (!card) return;
    e.preventDefault();
    picked = [card.dataset["pick"] || ""];
    apply();
  });

  search.addEventListener("input", () => {
    query = search.value;
    paint();
  });

  paint();
  try {
    search.focus();
  } catch (_) {}

  const handle: CatalogPickerHandle = { close: () => close(true), el: m };
  open.set(o.key, handle);
  return handle;
}
