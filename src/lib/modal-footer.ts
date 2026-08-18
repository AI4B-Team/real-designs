/**
 * One modal action system for the whole product.
 *
 * Every confirmation, picker, warning and editor modal builds its footer from
 * here, so the hierarchy never drifts: exactly one dominant action on the far
 * right (solid REAL DESIGNS red, primary or destructive), the neutral ghost
 * action immediately to its left, one gap, one height, one radius.
 *
 * The styles live unscoped in src/styles.css under `.rdm-*`, so a footer looks
 * identical whether the modal renders inside the app shell or is portalled to
 * <body>.
 */

export type ModalAction = {
  /** Button text. Destructive labels must name the result ("Delete Photo"). */
  label: string;
  /** Value returned / echoed through the button's data-mfa attribute. */
  value?: string;
  icon?: string;
  disabled?: boolean;
  /** Explains a disabled state; also used as the title tooltip. */
  hint?: string;
  /** Reserved width label used while loading ("Deleting…"). */
  loadingLabel?: string;
};

export type ModalFooterOptions = {
  primary?: ModalAction | null;
  /** Optional third, neutral action placed left of the secondary action. */
  extra?: ModalAction | null;
  secondary?: ModalAction | null;
  /** true => the dominant action is a destructive confirmation. */
  destructive?: boolean;
  loading?: boolean;
  alignment?: "end" | "between";
  stackOnMobile?: boolean;
};

const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

function btn(a: ModalAction, kind: "primary" | "danger" | "ghost", loading = false) {
  const label = loading && a.loadingLabel ? a.loadingLabel : a.label;
  const dis = a.disabled || loading;
  return `<button type="button" class="rdm-btn rdm-${kind}${loading ? " is-loading" : ""}"
    data-mfa="${esc(a.value || (kind === "ghost" ? "cancel" : "confirm"))}"${dis ? " disabled aria-disabled=\"true\"" : ""}${
      a.hint ? ` title="${esc(a.hint)}"` : ""
    }>${loading ? '<span class="rdm-spin" aria-hidden="true"></span>' : a.icon ? `<i data-lucide="${esc(a.icon)}"></i>` : ""}<span>${esc(label)}</span></button>`;
}

/**
 * Secondary first, dominant action last on the far right. The dominant action
 * is red whether it advances the flow or destroys something; the wording, the
 * title and the body carry the difference in meaning.
 */
export function modalFooterHtml(opts: ModalFooterOptions = {}) {
  const cls = [
    "rdm-foot",
    opts.alignment === "between" ? "between" : "",
    opts.stackOnMobile === false ? "" : "stackable",
  ]
    .filter(Boolean)
    .join(" ");
  const parts: string[] = [];
  if (opts.extra) parts.push(btn(opts.extra, "ghost"));
  if (opts.secondary) parts.push(btn(opts.secondary, "ghost"));
  if (opts.primary) parts.push(btn(opts.primary, opts.destructive ? "danger" : "primary", !!opts.loading));
  return `<div class="${cls}">${parts.join("")}</div>`;
}

/**
 * Put a footer button into its loading state without letting it change width,
 * and block the repeat click that would submit twice.
 */
export function setModalButtonLoading(button: HTMLButtonElement | null, loading: boolean, label?: string) {
  if (!button) return;
  if (loading) {
    button.style.minWidth = button.offsetWidth + "px";
    button.dataset["mfaLabel"] = button.dataset["mfaLabel"] || button.textContent || "";
    button.disabled = true;
    button.classList.add("is-loading");
    button.innerHTML = `<span class="rdm-spin" aria-hidden="true"></span><span>${esc(label || button.dataset["mfaLabel"])}</span>`;
  } else {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.innerHTML = `<span>${esc(button.dataset["mfaLabel"] || "")}</span>`;
    button.style.minWidth = "";
  }
}
