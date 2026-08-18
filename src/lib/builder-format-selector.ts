/**
 * One segmented format selector for every builder header.
 *
 * The Video Builder's "Video Format" control and Photo Design's "Output Ratio"
 * control are the same component: identical label treatment, button height,
 * spacing, selected/hover/focus states and the same collapse-to-dropdown
 * behaviour on narrow headers. Only the label, the option list and the
 * handling of the chosen value differ.
 */
/* eslint-disable */
// @ts-nocheck

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );

const optLabel = (o) => (o.note ? `${o.label} ${o.note}` : o.label);

/**
 * opts:
 *   label   — "Video Format" | "Output Ratio"
 *   options — [{ id, label, note? }]
 *   value   — selected id
 *   attr    — data attribute name used for the click/change hooks
 *             (buttons get data-<attr>, the dropdown data-<attr>sel)
 *   id      — optional dom id prefix for the aria wiring
 */
export function formatSelectorHtml(opts = {}) {
  const label = opts.label || "Format";
  const options = opts.options || [];
  const value = opts.value;
  const attr = opts.attr || "fmt";
  const base = opts.id || "bxfmt-" + attr;
  const current = options.find((o) => o.id === value) || options[0] || { id: "", label: "" };
  return `<div class="rv-orient bx-fmtsel">
    <span id="${esc(base)}-lbl">${esc(label)}</span>
    <div class="rv-seg bx-fmtseg" role="group" aria-labelledby="${esc(base)}-lbl">${options
      .map(
        (o) => `<button type="button" class="${o.id === current.id ? "on" : ""}" data-${esc(attr)}="${esc(o.id)}"
        aria-pressed="${o.id === current.id ? "true" : "false"}">${esc(optLabel(o))}</button>`,
      )
      .join("")}</div>
    <label class="bx-fmtsel-c">
      <span>${esc(label)}:</span>
      <select data-${esc(attr)}sel aria-label="${esc(label)}">${options
        .map(
          (o) =>
            `<option value="${esc(o.id)}"${o.id === current.id ? " selected" : ""}>${esc(optLabel(o))}</option>`,
        )
        .join("")}</select>
    </label>
  </div>`;
}
