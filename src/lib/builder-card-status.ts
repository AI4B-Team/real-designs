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
 * Clicking the indicator opens a compact popover — anchored under the trigger
 * with a directional caret — listing one short row per feature with an Edit
 * action and a small More menu holding Reset and Remove.
 *
 * Transitions and the video ending are deliberately NOT features: they live
 * between cards, never in this indicator.
 */
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";

const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const paint = (root) => {
  try {
    createIcons({ icons, nameAttr: "data-lucide", root: root || document });
  } catch (_) {
    try {
      createIcons({ icons });
    } catch (_) {}
  }
};

/* flow -> { features(key), edit(key, id), remove(key, id), reset(key, id), title } */
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
  const icon = multi ? "sparkles" : features[0].icon || "sparkles";
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
  try {
    el.remove();
  } catch (_) {}
  if (btn) {
    btn.setAttribute("aria-expanded", "false");
    btn.classList.remove("on");
    if (restoreFocus) {
      try {
        btn.focus();
      } catch (_) {}
    }
  }
}

/**
 * Anchor under the trigger, right edges aligned. Shift inward at the right
 * boundary, flip above near the bottom, and keep the caret pointing at the
 * indicator that opened it. Never widens or scrolls the page.
 */
function place(el, btn) {
  const r = btn.getBoundingClientRect();
  const pad = 8;
  const gap = 8;
  const w = el.offsetWidth;
  const h = el.offsetHeight;

  let left = r.right - w;
  if (left + w > window.innerWidth - pad) left = window.innerWidth - pad - w;
  if (left < pad) left = pad;

  let top = r.bottom + gap;
  let up = false;
  if (top + h > window.innerHeight - pad) {
    const above = r.top - gap - h;
    if (above >= pad) {
      top = above;
      up = true;
    } else top = Math.max(pad, window.innerHeight - pad - h);
  }
  el.style.left = Math.round(left) + "px";
  el.style.top = Math.round(top) + "px";
  el.classList.toggle("up", up);

  /* caret sits over the middle of the trigger, clamped inside the card */
  const cx = Math.min(Math.max(r.left + r.width / 2 - left, 14), Math.max(14, w - 14));
  el.style.setProperty("--bx-caret", Math.round(cx) + "px");
}

function rowsHtml(features) {
  return features
    .map(
      (f) => `<div class="bx-cstat-row" data-cstat-row="${esc(f.id)}">
      <i data-lucide="${esc(f.icon || "sparkles")}"></i>
      <span><b>${esc(f.label)}</b><em>${esc(f.value || "On")}</em></span>
      <button type="button" class="bx-cstat-a" data-cstat-edit="${esc(f.id)}" title="Edit ${esc(f.label)}">Edit</button>
      <button type="button" class="bx-cstat-m" data-cstat-more="${esc(f.id)}" aria-haspopup="menu"
        aria-expanded="false" aria-label="More options for ${esc(f.label)}"><i data-lucide="ellipsis-vertical"></i></button>
    </div>`,
    )
    .join("");
}

function bodyHtml(features, title) {
  const n = features.length;
  return `<div class="bx-cstat-h"><b>${esc(title || "Scene Enhancements")}</b><em>${n} Active</em></div>
    <div class="bx-cstat-list${n > 5 ? " scroll" : ""}">${rowsHtml(features)}</div>
    <i class="bx-cstat-caret" aria-hidden="true"></i>`;
}

function closeRowMenu(el) {
  try {
    el.querySelector(".bx-cstat-rowmenu")?.remove();
  } catch (_) {}
  el.querySelectorAll("[data-cstat-more]").forEach((b) => b.setAttribute("aria-expanded", "false"));
}

function openRowMenu(el, btn, feature, run) {
  closeRowMenu(el);
  const m = document.createElement("div");
  m.className = "bx-cstat-rowmenu";
  m.setAttribute("role", "menu");
  m.innerHTML = `
    <button type="button" role="menuitem" data-rm="edit"><i data-lucide="pencil"></i><span>Edit</span></button>
    <button type="button" role="menuitem" data-rm="reset"><i data-lucide="rotate-ccw"></i><span>Reset to Default</span></button>
    ${feature.removable === false ? "" : `<button type="button" role="menuitem" class="bad" data-rm="remove"><i data-lucide="trash-2"></i><span>Remove</span></button>`}`;
  const row = btn.closest(".bx-cstat-row");
  m.style.top = Math.round(row.offsetTop + row.offsetHeight - 4) + "px";
  el.appendChild(m);
  paint(m);
  btn.setAttribute("aria-expanded", "true");
  m.querySelector("button")?.focus();
  m.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rm]");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    run(b.getAttribute("data-rm"), feature.id);
  });
}

function openPop(btn) {
  const flow = btn.getAttribute("data-cardstatflow");
  const key = btn.getAttribute("data-cardstat");
  const api = FLOWS.get(flow);
  if (!api || typeof api.features !== "function") return;
  const features = (api.features(key) || []).filter(Boolean);
  if (!features.length) return;

  closeCardStatus(false);
  try {
    window.__bxCloseCardMenu && window.__bxCloseCardMenu(false);
  } catch (_) {}

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
  try {
    el.querySelector(".bx-cstat-a")?.focus();
  } catch (_) {}

  const run = (action, id) => {
    closeCardStatus(true);
    try {
      if (action === "edit") api.edit && api.edit(key, id);
      else if (action === "reset")
        (api.reset || api.remove) && (api.reset || api.remove).call(api, key, id);
      else if (action === "remove") api.remove && api.remove(key, id);
    } catch (_) {}
  };

  el.addEventListener("click", (e) => {
    const ed = e.target.closest("[data-cstat-edit]");
    if (ed) {
      e.preventDefault();
      e.stopPropagation();
      return run("edit", ed.getAttribute("data-cstat-edit"));
    }
    const more = e.target.closest("[data-cstat-more]");
    if (more) {
      e.preventDefault();
      e.stopPropagation();
      const id = more.getAttribute("data-cstat-more");
      if (more.getAttribute("aria-expanded") === "true") return closeRowMenu(el);
      const f = features.find((x) => x.id === id) || { id };
      return openRowMenu(el, more, f, run);
    }
    if (!e.target.closest(".bx-cstat-rowmenu")) closeRowMenu(el);
  });

  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (el.querySelector(".bx-cstat-rowmenu")) return closeRowMenu(el);
      closeCardStatus(true);
    } else if (e.key === "Tab") {
      const list = Array.from(el.querySelectorAll("button:not([disabled])"));
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
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
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
      if (open && open.btn === btn) {
        closeCardStatus(true);
        return;
      }
      openPop(btn);
    },
    true,
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) {
      closeCardStatus(true);
      return;
    }
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
  window.addEventListener(
    "scroll",
    () => {
      if (open) place(open.el, open.btn);
    },
    true,
  );
  window.__bxCloseCardStatus = closeCardStatus;
}
