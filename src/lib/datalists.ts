/**
 * Replaces the OS-rendered (often dark) native <datalist> popup on text inputs
 * with a white, app-styled suggestion list that reuses the select menu styling.
 * Applies to every current input[list] and, via a MutationObserver, to any
 * input added later.
 */

const enhanced = new WeakSet<HTMLInputElement>();
let openedAt = 0;

type Cleanup = () => void;

function closeMenu() {
  document.querySelectorAll(".rdsel-menu.rdlist-menu").forEach((n) => n.remove());
}

function optionsFor(input: HTMLInputElement): string[] {
  const id = input.getAttribute("data-list") || "";
  const dl = id ? (document.getElementById(id) as HTMLDataListElement | null) : null;
  if (!dl) return [];
  return Array.from(dl.options)
    .map((o) => o.value || o.textContent || "")
    .filter(Boolean);
}

function openMenu(input: HTMLInputElement) {
  closeMenu();
  if (input.disabled || input.readOnly) return;

  const q = (input.value || "").trim().toLowerCase();
  const all = optionsFor(input);
  const list = (q ? all.filter((v) => v.toLowerCase().includes(q)) : all).slice(0, 12);
  if (!list.length) return;

  const menu = document.createElement("div");
  menu.className = "rdsel-menu rdlist-menu";
  menu.setAttribute("role", "listbox");

  list.forEach((value) => {
    const row = document.createElement("div");
    row.className = "rdsel-opt";
    row.setAttribute("role", "option");
    row.textContent = value;
    row.addEventListener("mousedown", (e) => {
      e.preventDefault();
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      closeMenu();
    });
    menu.appendChild(row);
  });

  document.body.appendChild(menu);
  openedAt = Date.now();

  const r = input.getBoundingClientRect();
  const width = Math.max(r.width, 200);
  menu.style.width = width + "px";
  menu.style.left = Math.min(r.left, window.innerWidth - width - 8) + "px";

  const below = window.innerHeight - r.bottom;
  const h = menu.offsetHeight;
  if (below < h + 12 && r.top > below) {
    menu.style.top = Math.max(8, r.top - h - 6) + "px";
  } else {
    menu.style.top = r.bottom + 6 + "px";
    menu.style.maxHeight = Math.max(140, below - 16) + "px";
  }
}

function enhance(input: HTMLInputElement) {
  if (enhanced.has(input)) return;
  const listId = input.getAttribute("list");
  if (!listId) return;
  enhanced.add(input);
  // Detach from the native popup, but keep the option source reachable.
  input.setAttribute("data-list", listId);
  input.removeAttribute("list");
  input.setAttribute("autocomplete", "off");

  input.addEventListener("focus", () => openMenu(input));
  input.addEventListener("input", () => openMenu(input));
  input.addEventListener("blur", () => window.setTimeout(closeMenu, 120));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}

export function initDatalists(root: ParentNode = document): Cleanup {
  if (typeof document === "undefined") return () => {};

  const scan = (scope: ParentNode) => {
    if (scope instanceof HTMLInputElement) enhance(scope);
    scope.querySelectorAll?.("input[list]").forEach((i) => enhance(i as HTMLInputElement));
  };
  scan(root);

  const obs = new MutationObserver((muts) => {
    for (const m of muts)
      m.addedNodes.forEach((n) => {
        if (n instanceof Element) scan(n);
      });
  });
  obs.observe(document.body, { childList: true, subtree: true });

  const onScroll = (e: Event) => {
    if (Date.now() - openedAt < 250) return;
    if (e.target instanceof Element && e.target.closest(".rdlist-menu")) return;
    closeMenu();
  };
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onScroll);

  return () => {
    obs.disconnect();
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onScroll);
    closeMenu();
  };
}
