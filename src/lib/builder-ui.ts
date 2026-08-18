/* Shared builder chrome.
 *
 * The photo-staging builder and the property-video builder used to draw their
 * own progress rail, room-type control and selection visuals. They now share
 * these primitives so the two workflows read as one product: same step rail,
 * same room selector, same selection treatment.
 */
/* eslint-disable */
// @ts-nocheck

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );

/**
 * Progress rail shared by both builders.
 *
 * steps:  [{ key, label, icon, done?, ready?, badge? }]
 * attr:   data attribute each builder already listens to ("sec" | "step")
 * variant:"col" for the video builder's left rail, "row" for staging's header
 * extra:  legacy class names kept on the nav / items so existing CSS and
 *         click handlers in each builder keep working untouched.
 */
export function builderRailHtml(opts = {}) {
  const steps = opts.steps || [];
  const attr = opts.attr || "step";
  const variant = opts.variant === "row" ? "row" : "col";
  const navCls = ["bx-rail", variant, opts.navClass || ""].filter(Boolean).join(" ");
  const itemCls = opts.itemClass || "";
  const numbered = opts.numbered !== false && variant === "row";
  return `<nav class="${navCls}" aria-label="${esc(opts.label || "Builder steps")}">${steps
    .map((st, i) => {
      const on = st.key === opts.active;
      const ready = st.ready !== false;
      const done = !!st.done && !on;
      const cls = ["bx-step", itemCls, on ? "on" : "", done ? "done" : "", ready ? "" : "off"]
        .filter(Boolean)
        .join(" ");
      const icon = done ? "check" : st.icon || "circle";
      return `<button class="${cls}" data-${esc(attr)}="${esc(st.key)}"${ready ? "" : " disabled"}${
        on ? ' aria-current="step"' : ""
      }>
        <i data-lucide="${esc(icon)}"></i><span>${numbered ? `<b>Step ${i + 1}</b>` : ""}${esc(st.label)}</span>${
          st.badge ? `<i class="rv-badge bx-badge mono">${esc(st.badge)}</i>` : ""
        }</button>`;
    })
    .join("")}</nav>`;
}

/** One room-type control for both builders: a compact select-style button. */
export function roomSelectHtml(opts = {}) {
  const label = opts.label || "";
  const unknown = !!opts.unknown;
  const cls = ["bx-room", opts.variant === "inline" ? "inline" : "boxed", opts.className || "", unknown ? "muted" : "", opts.manual ? "set" : ""]
    .filter(Boolean)
    .join(" ");
  const name = label || "Not Set";
  return `<button type="button" class="${cls}" data-${esc(opts.attr || "room")}="${esc(opts.key || "")}"
    aria-haspopup="listbox" aria-expanded="${opts.expanded ? "true" : "false"}" aria-label="Change room type. Current room: ${esc(name)}"
    title="Change Room Type">
    <i data-lucide="${esc(opts.icon || "circle-dashed")}"></i><span>${esc(label)}</span>
    <i data-lucide="chevron-down" class="bx-caret"></i>
  </button>`;
}

/** Shared room-state badge used under a photo in either builder.
   Settled results (confident AI, manual, custom, saved) show nothing at all —
   the selector already carries the value. Only transient or uncertain states
   earn a line of text. Detection source/confidence stay in state for logic. */
export function roomBadge(state = {}) {
  if (state.detect === "running" || state.detect === "pending") return { cls: "wait", label: "Detecting…" };
  if (state.detect === "failed") return { cls: "warn", label: "Couldn’t detect" };
  if (state.source === "manual" || state.source === "library") return null;
  if (state.source === "ai") return state.confident ? null : { cls: "warn", label: "Review" };
  return null;
}

/** Shared selection chip: a dark check tile, identical in both builders. */
export function selectCheckHtml(opts = {}) {
  return `<span class="bx-check"${opts.hidden ? ' aria-hidden="true"' : ""}><i data-lucide="check"></i></span>`;
}

/** Shared sequence badge: presentation order only, never a stable id.
   Hidden while the hover/focus toolbar is open (see .rv-tile-seq rules); the
   order still reaches assistive tech through the card's aria-label. */
export function sceneNumberHtml(n) {
  const num = Number(n);
  if (!num || num < 1) return "";
  return `<span class="rv-tile-seq mono" aria-hidden="true">${esc(num)}</span>`;
}


/** Shared autosave status wording. */
export function saveLabel(state) {
  if (state === "saving") return "Saving…";
  if (state === "saved") return "Saved";
  if (state === "error") return "Couldn’t Save — Retry";
  return "";
}

/**
 * One image hover toolbar for every editable photo grid.
 *
 * actions: [{ attr, value, label, icon, hot?, extraAttrs? }]
 * Rendered as a single white pill centered near the bottom of the image; the
 * markup and classes are identical in both builders so one stylesheet rule
 * governs placement, motion, tooltips and focus behaviour.
 */
export function imageToolbarHtml(actions = [], opts = {}) {
  const items = (actions || []).filter(Boolean);
  if (!items.length) return "";
  const buttons = items
    .map((a) => {
      const attrs = Object.entries(a.attrs || {})
        .map(([k, v]) => ` ${esc(k)}="${esc(v)}"`)
        .join("");
      return `<button type="button" class="rv-tool${a.hot ? " hot" : ""}"${attrs} aria-label="${esc(a.label)}"><i data-lucide="${esc(a.icon)}"></i><em>${esc(a.label)}</em></button>`;
    })
    .join("");
  return `<div class="rv-tools" role="toolbar" aria-label="${esc(opts.label || "Photo actions")}">${buttons}</div>
    <button type="button" class="rv-tools-more" data-toolsmore="1" aria-label="${esc(opts.label || "Photo actions")}" title="${esc(opts.label || "Photo actions")}"><i data-lucide="ellipsis"></i></button>`;
}

/* Escape inside the toolbar hands focus back to the photo card it belongs to,
   so keyboard users are never stranded inside the temporary controls. */
if (typeof document !== "undefined" && !document.__rdToolbarKeys) {
  document.__rdToolbarKeys = true;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const tools = e.target && e.target.closest && e.target.closest(".rv-tools");
    if (!tools) {
      document.querySelectorAll(".rv-tile.tools-open").forEach((t) => t.classList.remove("tools-open"));
      return;
    }
    const card = tools.closest(".rv-tile");
    const th = card && card.querySelector(".rv-tile-th");
    if (th) { e.stopPropagation(); th.focus(); }
  });

  /* Touch has no hover: tapping a photo reveals the same toolbar, and tapping
     anywhere else dismisses it. Mouse and keyboard keep the hover/focus path. */
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType !== "touch") return;
      const t = e.target;
      const inTools = t && t.closest && t.closest(".rv-tools, .rv-tools-more");
      const tile = t && t.closest && t.closest(".rv-tile");
      document.querySelectorAll(".rv-tile.tools-open").forEach((x) => {
        if (x !== tile) x.classList.remove("tools-open");
      });
      if (tile && !inTools) tile.classList.add("tools-open");
    },
    true,
  );
}

