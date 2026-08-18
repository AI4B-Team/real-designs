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

/** One room-type control for both builders. */
export function roomSelectHtml(opts = {}) {
  const label = opts.label || "";
  const unknown = !!opts.unknown;
  const cls = ["bx-room", opts.variant === "inline" ? "inline" : "boxed", opts.className || "", unknown ? "muted" : "", opts.manual ? "set" : ""]
    .filter(Boolean)
    .join(" ");
  return `<button class="${cls}" data-${esc(opts.attr || "room")}="${esc(opts.key || "")}"
    aria-haspopup="listbox" title="Click To Change Room Type">
    <i data-lucide="${esc(opts.icon || "circle-dashed")}"></i><span>${esc(label)}</span>
    <i data-lucide="chevron-down" class="bx-caret"></i>
  </button>`;
}

/** Shared room-state badge wording used under a photo in either builder. */
export function roomBadge(state = {}) {
  if (state.detect === "running" || state.detect === "pending") return { cls: "wait", label: "Detecting" };
  if (state.source === "manual") return { cls: "ok", label: state.custom ? "Custom" : "Changed" };
  /* A label carried in from an already-saved photo was not changed here. */
  if (state.source === "library") return { cls: "ok", label: "Saved" };
  if (state.source === "ai" && state.confident) return { cls: "ok", label: "Detected" };
  if (state.source === "ai") return { cls: "warn", label: "Needs Review" };
  return { cls: "warn", label: "Unassigned" };
}

/** Shared selection chip: a dark check tile, identical in both builders. */
export function selectCheckHtml(opts = {}) {
  return `<span class="bx-check"${opts.hidden ? ' aria-hidden="true"' : ""}><i data-lucide="check"></i></span>`;
}

/** Shared autosave status wording. */
export function saveLabel(state) {
  if (state === "saving") return "Saving…";
  if (state === "saved") return "Saved";
  if (state === "error") return "Couldn’t Save — Retry";
  return "";
}
