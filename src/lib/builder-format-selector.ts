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
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
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
  /* Some surfaces (Photo Design) keep extra ratios behind "More Ratios". The
     header still shows only the primary buttons; a value picked from the extra
     list is shown as a compact custom chip instead of a fourth button. */
  const more = opts.more || null; // { label, value: "__more" } | null
  const custom =
    more && value && !options.some((o) => o.id === value) ? opts.customLabel || String(value) : "";
  const current =
    options.find((o) => o.id === value) ||
    (custom ? { id: "", label: "" } : options[0] || { id: "", label: "" });
  return `<div class="rv-orient bx-fmtsel">
    <span id="${esc(base)}-lbl">${esc(label)}</span>
    <div class="rv-seg bx-fmtseg" role="group" aria-labelledby="${esc(base)}-lbl">${options
      .map(
        (
          o,
        ) => `<button type="button" class="${o.id === current.id ? "on" : ""}" data-${esc(attr)}="${esc(o.id)}"
        aria-pressed="${o.id === current.id ? "true" : "false"}">${esc(optLabel(o))}</button>`,
      )
      .join("")}</div>
    ${custom ? `<button type="button" class="bx-fmtcustom" data-${esc(attr)}more>Custom: ${esc(custom)}</button>` : ""}
    <label class="bx-fmtsel-c">
      <span>${esc(label)}:</span>
      <select data-${esc(attr)}sel aria-label="${esc(label)}">${options
        .map(
          (o) =>
            `<option value="${esc(o.id)}"${o.id === current.id ? " selected" : ""}>${esc(optLabel(o))}</option>`,
        )
        .join("")}${
        custom ? `<option value="${esc(value)}" selected>${esc(custom)}</option>` : ""
      }${more ? `<option value="__more">${esc(more.label || "More Ratios")}</option>` : ""}</select>
    </label>
  </div>`;
}
