/**
 * Replaces the OS-rendered (often dark) native <select> popup with a white,
 * app-styled listbox. Applies to every current select and, via a
 * MutationObserver, to any select added later.
 */

const MARK = "data-rdsel";

let openedAt = 0;

type Cleanup = () => void;

function closeMenu() {
  if (document.querySelector(".rdsel-menu")) console.log("RDSEL close", new Error().stack);
  document.querySelectorAll(".rdsel-menu").forEach((n) => n.remove());
  document.querySelectorAll("select." + "rdsel-open").forEach((n) => n.classList.remove("rdsel-open"));
}

function openMenu(sel: HTMLSelectElement) {
  closeMenu();
  if (sel.disabled) return;

  const menu = document.createElement("div");
  menu.className = "rdsel-menu";
  menu.setAttribute("role", "listbox");

  const opts = Array.from(sel.options);
  opts.forEach((opt) => {
    const row = document.createElement("div");
    row.className = "rdsel-opt" + (opt.selected ? " is-sel" : "") + (opt.disabled ? " is-off" : "");
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(opt.selected));
    row.textContent = opt.label || opt.text;
    row.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (opt.disabled) return;
      sel.value = opt.value;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      closeMenu();
    });
    menu.appendChild(row);
  });

  document.body.appendChild(menu);
  openedAt = Date.now();
  sel.classList.add("rdsel-open");

  const r = sel.getBoundingClientRect();
  const width = Math.max(r.width, 160);
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

  const sel2 = menu.querySelector<HTMLElement>(".is-sel");
  if (sel2) menu.scrollTop = Math.max(0, sel2.offsetTop - menu.clientHeight / 2);
}

function enhance(sel: HTMLSelectElement) {
  if (sel.multiple || sel.size > 1 || sel.hasAttribute(MARK) || sel.hasAttribute("data-native-select")) return;
  sel.setAttribute(MARK, "1");
  sel.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (sel.classList.contains("rdsel-open")) closeMenu();
    else {
      sel.focus();
      openMenu(sel);
    }
  });
  sel.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu(sel);
    } else if (e.key === "Escape") closeMenu();
  });
}

export function initSelects(root: ParentNode = document): Cleanup {
  if (typeof document === "undefined") return () => {};

  const scan = (scope: ParentNode) => {
    if (scope instanceof HTMLSelectElement) enhance(scope);
    scope.querySelectorAll?.("select").forEach((s) => enhance(s as HTMLSelectElement));
  };
  scan(root);

  const obs = new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach((n) => { if (n instanceof Element) scan(n); });
  });
  obs.observe(document.body, { childList: true, subtree: true });

  const onScroll = (e: Event) => {
    if (Date.now() - openedAt < 250) return;
    if (e.target instanceof Element && e.target.closest(".rdsel-menu")) return;
    closeMenu();
  };
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onScroll);
  document.addEventListener("mousedown", (e) => {
    const t = e.target as Element | null;
    if (!t?.closest?.(".rdsel-menu") && !(t instanceof HTMLSelectElement)) closeMenu();
  });

  return () => {
    obs.disconnect();
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onScroll);
    closeMenu();
  };
}
