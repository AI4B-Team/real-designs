/**
 * One consolidated feature-status indicator for builder cards.
 *
 * A card can carry several active scene-level features (motion, VFX, text,
 * crop, duration, design settings...). Rather than stacking one badge per
 * feature on top of the photo, every builder renders a single indicator that
 * sits immediately to the left of the bare three-dot menu:
 *
 *     [ feature status ] [ ⋮ ]
 *
 * One active feature shows that feature's own icon. Two or more collapse into
 * a Layers pill with a count. No active features renders nothing at all.
 * Clicking the indicator opens a compact summary popover with an Edit (and,
 * when safe, Remove) action per feature.
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

/* flow -> { features(key), edit(key, id), remove(key, id), title } */
const FLOWS = new Map();

export function registerCardStatus(flow, api) {
  FLOWS.set(flow, api || {});
}

/** "Motion, VFX and Text" */
function joinNames(list) {
  const n = list.map((f) => f.label);
  if (n.length <= 1) return n[0] || "";
  return n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
}

function summaryLabel(features, noun) {
  if (features.length === 1) {
    const f = features[0];
    return `${f.label}: ${f.value || "On"}. Open the ${f.label.toLowerCase()} settings.`;
  }
  return `${features.length} ${noun || "enhancements"} applied: ${joinNames(features)}`;
}

/**
 * The indicator markup. `features` is the already-computed active list:
 * [{ id, icon, label, value, removable }]. An empty list renders nothing, so a
 * card never shows an empty status chip.
 */
export function cardStatusHtml(opts = {}) {
  const flow = opts.flow || "";
  const key = opts.key || "";
  const features = (opts.features || []).filter(Boolean);
  if (!features.length) return "";
  const multi = features.length > 1;
  const icon = multi ? "layers" : features[0].icon || "sparkles";
  const tip = multi
    ? `${features.length} ${opts.noun || "enhancements"}: ${joinNames(features)}`
    : `${features[0].label}: ${features[0].value || "On"}`;
  return `<button type="button" class="bx-cstat${multi ? " multi" : ""}${opts.tone ? " " + esc(opts.tone) : ""}"
    data-cardstat="${esc(key)}" data-cardstatflow="${esc(flow)}" aria-haspopup="dialog" aria-expanded="false"
    title="${esc(tip)}" aria-label="${esc(summaryLabel(features, opts.noun))}"><i data-lucide="${esc(icon)}"></i>${
      multi ? `<b>${features.length}</b>` : ""
    }</button>`;
}

/* ------------------------------------------------------------------ portal */

let open = null; /* { btn, el, flow, key } */

export function closeCardStatus(restoreFocus) {
  if (!open) return;
  const { btn, el } = open;
  open = null;
  try { el.remove(); } catch (_) {}
  if (btn) {
    btn.setAttribute("aria-expanded", "false");
    btn.classList.remove("on");
    if (restoreFocus) { try { btn.focus(); } catch (_) {} }
  }
}

function place(el, btn) {
  const r = btn.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const pad = 8;
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

function bodyHtml(features, title) {
  return `<h4>${esc(title || "Scene Enhancements")}</h4>${features
    .map(
      (f) => `<div class="bx-cstat-row">
      <i data-lucide="${esc(f.icon || "sparkles")}"></i>
      <span><b>${esc(f.label)}</b><em>${esc(f.value || "On")}</em></span>
      <button type="button" class="bx-cstat-a" data-cstat-edit="${esc(f.id)}">Edit</button>
      ${f.removable ? `<button type="button" class="bx-cstat-a bad" data-cstat-rm="${esc(f.id)}">Remove</button>` : ""}
    </div>`,
    )
    .join("")}`;
}

function openPop(btn) {
  const flow = btn.getAttribute("data-cardstatflow");
  const key = btn.getAttribute("data-cardstat");
  const api = FLOWS.get(flow);
  if (!api || typeof api.features !== "function") return;
  const features = (api.features(key) || []).filter(Boolean);
  if (!features.length) return;

  closeCardStatus(false);
  try { window.__bxCloseCardMenu && window.__bxCloseCardMenu(false); } catch (_) {}

  const el = document.createElement("div");
  el.className = "bx-cstatpop";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", api.title || "Scene Enhancements");
  el.innerHTML = bodyHtml(features, api.title);
  document.body.appendChild(el);
  paint(el);
  place(el, btn);

  btn.setAttribute("aria-expanded", "true");
  btn.classList.add("on");
  open = { btn, el, flow, key };
  try { el.querySelector(".bx-cstat-a")?.focus(); } catch (_) {}

  el.addEventListener("click", (e) => {
    const ed = e.target.closest("[data-cstat-edit]");
    const rm = e.target.closest("[data-cstat-rm]");
    if (!ed && !rm) return;
    e.preventDefault();
    e.stopPropagation();
    const id = (ed || rm).getAttribute(ed ? "data-cstat-edit" : "data-cstat-rm");
    closeCardStatus(true);
    try {
      if (ed) api.edit && api.edit(key, id);
      else api.remove && api.remove(key, id);
    } catch (_) {}
  });

  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeCardStatus(true); }
    else if (e.key === "Tab") {
      const list = Array.from(el.querySelectorAll(".bx-cstat-a"));
      if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      e.preventDefault();
      list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length].focus();
    }
  });
}

if (typeof document !== "undefined" && !document.__bxCardStatus) {
  document.__bxCardStatus = true;
  document.addEventListener(
    "pointerdown",
    (e) => {
      const btn = e.target?.closest?.("[data-cardstat]");
      if (btn) { e.preventDefault(); e.stopPropagation(); return; }
      if (open && !e.target?.closest?.(".bx-cstatpop")) closeCardStatus(false);
    },
    true,
  );
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target?.closest?.("[data-cardstat]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (open && open.btn === btn) { closeCardStatus(true); return; }
      openPop(btn);
    },
    true,
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) { closeCardStatus(true); return; }
    const btn = e.target?.closest?.("[data-cardstat]");
    if (!btn) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (open && open.btn === btn) closeCardStatus(true);
      else openPop(btn);
    }
  });
  document.addEventListener("dragstart", () => closeCardStatus(false), true);
  window.addEventListener("resize", () => closeCardStatus(false));
  window.addEventListener("scroll", () => { if (open) place(open.el, open.btn); }, true);
  window.__bxCloseCardStatus = closeCardStatus;
}
