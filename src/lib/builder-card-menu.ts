/**
 * One card overflow menu for every builder.
 *
 * Photo Design cards and Video scene cards used to expose different ad-hoc
 * controls. They now share this component, so the three-dot button, its
 * placement, its keyboard behaviour and the portalled dropdown are identical
 * in both workflows. Each builder only supplies its own action list and a
 * handler for those actions.
 */
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );

const paint = (root) => {
  try { createIcons({ icons, nameAttr: "data-lucide", root: root || document }); } catch (_) {
    try { createIcons({ icons }); } catch (_) {}
  }
};

const toast = (m) => { try { window.rdToast ? window.rdToast(m) : console.log(m); } catch (_) {} };

/* flow -> { items(key), run(action, key) } */
const FLOWS = new Map();

export function registerCardMenu(flow, api) {
  FLOWS.set(flow, api || {});
}

/**
 * The persistent three-dot button. Always visible, always the far top-right of
 * the image; any scene-status indicator sits to its left (see the CSS).
 */
export function cardMenuButtonHtml(opts = {}) {
  const label = opts.label || "this card";
  return `<button type="button" class="bx-cardmenu" data-cardmenu="${esc(opts.key || "")}"
    data-cardflow="${esc(opts.flow || "")}" aria-haspopup="menu" aria-expanded="false"
    aria-label="More options for ${esc(label)}" title="More Options"><i data-lucide="ellipsis-vertical"></i></button>`;
}

/* ------------------------------------------------------------------ portal */

let openState = null; /* { btn, el, items } */

export function closeCardMenu(restoreFocus) {
  if (!openState) return;
  const { btn, el } = openState;
  openState = null;
  try { el.remove(); } catch (_) {}
  if (btn) {
    btn.setAttribute("aria-expanded", "false");
    btn.classList.remove("on");
    if (restoreFocus) { try { btn.focus(); } catch (_) {} }
  }
}

function itemsOf(groups) {
  const flat = [];
  (groups || []).forEach((g) => (g.items || []).forEach((it) => { if (it && !it.hidden) flat.push(it); }));
  return flat;
}

function menuHtml(groups) {
  return (groups || [])
    .map((g) => {
      const list = (g.items || []).filter((i) => i && !i.hidden);
      if (!list.length) return "";
      return `<div class="bx-cmenu-g${g.danger ? " danger" : ""}" role="group"${
        g.label ? ` aria-label="${esc(g.label)}"` : ""
      }>${list
        .map(
          (it) => `<button type="button" role="menuitem" class="bx-cmenu-i${it.danger ? " bad" : ""}"
        data-cmact="${esc(it.action)}"${it.disabled ? ' aria-disabled="true" disabled' : ""}${
          it.tip ? ` title="${esc(it.tip)}"` : ""
        }${it.danger ? ' aria-describedby="bx-cmenu-warn"' : ""}>
        <i data-lucide="${esc(it.icon || "circle")}"></i><span>${esc(it.label)}</span>${
          it.note ? `<em>${esc(it.note)}</em>` : ""
        }</button>`,
        )
        .join("")}</div>`;
    })
    .filter(Boolean)
    .join('<div class="bx-cmenu-sep" role="separator"></div>');
}

function place(el, btn) {
  const r = btn.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const pad = 8;
  /* Prefer downward, right-aligned with the card; flip inward near the right
     edge and upward near the bottom so the menu stays inside the workspace. */
  let left = r.right - w;
  if (left + w > window.innerWidth - pad) left = window.innerWidth - pad - w;
  if (left < pad) left = pad;
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - pad) {
    const up = r.top - 6 - h;
    top = up >= pad ? up : Math.max(pad, window.innerHeight - pad - h);
  }
  el.style.left = Math.round(left) + "px";
  el.style.top = Math.round(top) + "px";
}

function openMenu(btn) {
  const flow = btn.getAttribute("data-cardflow");
  const key = btn.getAttribute("data-cardmenu");
  const api = FLOWS.get(flow);
  if (!api || typeof api.items !== "function") return;
  const groups = api.items(key) || [];
  if (!itemsOf(groups).length) return;

  closeCardMenu(false);
  try { window.__bxCloseCardStatus && window.__bxCloseCardStatus(false); } catch (_) {}

  const el = document.createElement("div");
  el.className = "bx-cmenu";
  el.setAttribute("role", "menu");
  el.setAttribute("aria-label", btn.getAttribute("aria-label") || "Card options");
  el.innerHTML = `${menuHtml(groups)}<span id="bx-cmenu-warn" class="bx-cmenu-warn">Destructive action. This cannot be undone.</span>`;
  document.body.appendChild(el);
  paint(el);
  place(el, btn);

  btn.setAttribute("aria-expanded", "true");
  btn.classList.add("on");
  openState = { btn, el, flow, key };

  const first = el.querySelector(".bx-cmenu-i:not([disabled])");
  if (first) { try { first.focus(); } catch (_) {} }

  el.addEventListener("click", (e) => {
    const it = e.target.closest("[data-cmact]");
    if (!it || it.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const action = it.getAttribute("data-cmact");
    closeCardMenu(true);
    try { api.run && api.run(action, key); } catch (err) { toast(err?.message || "That did not work."); }
  });

  el.addEventListener("keydown", (e) => {
    const list = Array.from(el.querySelectorAll(".bx-cmenu-i:not([disabled])"));
    const i = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
      list[next]?.focus();
    } else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); list[list.length - 1]?.focus(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeCardMenu(true); }
    else if (e.key === "Tab") { closeCardMenu(false); }
  });
}

if (typeof document !== "undefined" && !document.__bxCardMenu) {
  document.__bxCardMenu = true;
  /* The button owns its own pointer events: it never selects the card, opens
     the editor or starts a drag. */
  document.addEventListener(
    "pointerdown",
    (e) => {
      const btn = e.target?.closest?.("[data-cardmenu]");
      if (btn) { e.preventDefault(); e.stopPropagation(); return; }
      if (openState && !e.target?.closest?.(".bx-cmenu")) closeCardMenu(false);
    },
    true,
  );
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target?.closest?.("[data-cardmenu]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const same = openState && openState.btn === btn;
      if (same) { closeCardMenu(true); return; }
      openMenu(btn);
    },
    true,
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openState) { closeCardMenu(true); return; }
    const btn = e.target?.closest?.("[data-cardmenu]");
    if (!btn) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (openState && openState.btn === btn) closeCardMenu(true);
      else openMenu(btn);
    }
  });
  document.addEventListener("dragstart", () => closeCardMenu(false), true);
  window.__bxCloseCardMenu = closeCardMenu;
  window.addEventListener("resize", () => closeCardMenu(false));
  window.addEventListener("scroll", () => { if (openState) place(openState.el, openState.btn); }, true);
}

/* --------------------------------------------------------------- dialogs */

/**
 * Shared confirmation sheet. One dominant action on the far right, the neutral
 * Cancel to its left, both built by the shared modal footer so a confirmation
 * here looks exactly like one anywhere else in the product.
 */
export function confirmDialog(opts = {}) {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(false);
    const prev = document.activeElement;
    const wrap = document.createElement("div");
    wrap.className = "bx-cdlg";
    wrap.innerHTML = `<div class="bx-cdlg-in" role="dialog" aria-modal="true" aria-label="${esc(opts.title || "Confirm")}">
      <h3>${esc(opts.title || "Are You Sure?")}</h3>
      <p>${esc(opts.body || "")}</p>
      ${(opts.notes || []).map((n) => `<p class="bx-cdlg-note">${esc(n)}</p>`).join("")}
      ${modalFooterHtml({
        secondary: { label: opts.cancelLabel || "Cancel", value: "no" },
        primary: { label: opts.confirmLabel || "Confirm", value: "yes", icon: opts.confirmIcon },
        destructive: !!opts.danger,
      })}
    </div>`;
    document.body.appendChild(wrap);
    paint(wrap);
    const done = (v) => {
      wrap.remove();
      try { prev && prev.focus && prev.focus(); } catch (_) {}
      resolve(v);
    };
    wrap.addEventListener("click", (e) => {
      const b = e.target.closest("[data-mfa]");
      if (b) return done(b.getAttribute("data-mfa") === "yes");
      if (e.target === wrap) done(false);
    });
    wrap.addEventListener("keydown", (e) => { if (e.key === "Escape") done(false); });
    /* Focus lands on the safe action; a destructive confirm is never one
       stray Enter away. */
    const safe = wrap.querySelector('[data-mfa="no"]');
    const go = wrap.querySelector('[data-mfa="yes"]');
    ((opts.danger ? safe : go) || safe)?.focus();
  });
}

/** Read-only details sheet: filename, property, room, dates, dimensions. */
export function detailsDialog(opts = {}) {
  if (typeof document === "undefined") return;
  const rows = (opts.rows || []).filter((r) => r && r[1]);
  const wrap = document.createElement("div");
  wrap.className = "bx-cdlg";
  wrap.innerHTML = `<div class="bx-cdlg-in" role="dialog" aria-modal="true" aria-label="${esc(opts.title || "Details")}">
    <h3>${esc(opts.title || "Photo Details")}</h3>
    <dl class="bx-cdlg-dl">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    ${modalFooterHtml({ primary: { label: "Done", value: "no" } })}
  </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener("click", (e) => {
    if (e.target.closest("[data-mfa]") || e.target === wrap) wrap.remove();
  });
  wrap.addEventListener("keydown", (e) => { if (e.key === "Escape") wrap.remove(); });
  wrap.querySelector("[data-mfa]")?.focus();
}


/** A removal is always reversible for a few seconds. */
export function undoToast(message, onUndo) {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.className = "bx-undo";
  el.setAttribute("role", "status");
  el.innerHTML = `<span></span><button type="button">Undo</button>`;
  el.querySelector("span").textContent = message;
  document.body.appendChild(el);
  let live = true;
  const kill = () => { if (!live) return; live = false; el.remove(); };
  el.querySelector("button").addEventListener("click", () => {
    kill();
    try { onUndo && onUndo(); } catch (_) {}
  });
  window.setTimeout(kill, 8000);
}

/** Download the original uploaded file, never a generated version. */
export async function downloadOriginal(url, filename) {
  if (!url) { toast("That Original Is Not Available."); return; }
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename || "photo.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 4000);
  } catch (_) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  }
}

/** One hidden file input reused by every "Replace Photo" action. */
export function pickOneImage() {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.style.display = "none";
    document.body.appendChild(inp);
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      resolve(f || null);
    });
    inp.click();
  });
}
