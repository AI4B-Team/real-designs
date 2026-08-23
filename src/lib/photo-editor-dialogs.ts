/**
 * REAL DESIGNS — small form dialogs for the Photo Editor.
 *
 * Same sheet chrome and footer hierarchy as `confirmDialog`, but the body can
 * hold controls, so Privacy Blur targets, export options, preset naming and
 * batch selection all feel like one product rather than three.
 */
import { escapeHtml as esc } from "@/lib/safe-html";

import { modalFooterHtml } from "@/lib/modal-footer";
import { createIcons, icons } from "lucide";


export type FormDialogOptions = {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Runs on every input so the sheet can update itself live. */
  onInput?: (root: HTMLElement) => void;
};

/**
 * Resolves with the dialog root while it is still mounted, so the caller can
 * read its controls, or null when the user cancelled.
 */
export function formDialog(opts: FormDialogOptions): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    const prev = document.activeElement as HTMLElement | null;
    const wrap = document.createElement("div");
    wrap.className = "bx-cdlg";
    wrap.innerHTML = `<div class="bx-cdlg-in rdpe-dlg" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
      <h3>${esc(opts.title)}</h3>
      <div class="rdpe-dlg-body">${opts.body}</div>
      ${modalFooterHtml({
        secondary: { label: opts.cancelLabel || "Cancel", value: "no" },
        primary: { label: opts.confirmLabel || "Confirm", value: "yes" },
        destructive: !!opts.danger,
      })}
    </div>`;
    document.body.appendChild(wrap);
    try {
      createIcons({ icons, attrs: { "stroke-width": "1.75" }, nameAttr: "data-lucide" });
    } catch {
      /* icons are decoration here */
    }
    const done = (ok: boolean) => {
      const root = wrap.querySelector(".rdpe-dlg") as HTMLElement | null;
      const out = ok ? root : null;
      /* Detach after the caller has read the controls. */
      queueMicrotask(() => wrap.remove());
      try {
        prev?.focus?.();
      } catch {
        /* focus restoration is best effort */
      }
      resolve(out);
    };
    wrap.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("[data-mfa]");
      if (b) return done(b.getAttribute("data-mfa") === "yes");
      if (e.target === wrap) done(false);
      const chip = (e.target as HTMLElement).closest("[data-toggle]") as HTMLElement | null;
      if (chip) {
        chip.classList.toggle("on");
        chip.setAttribute("aria-pressed", chip.classList.contains("on") ? "true" : "false");
        opts.onInput?.(wrap);
      }
    });
    wrap.addEventListener("input", () => opts.onInput?.(wrap));
    wrap.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape") done(false);
    });
    (wrap.querySelector("input,select,textarea,[data-mfa='yes']") as HTMLElement | null)?.focus();
    opts.onInput?.(wrap);
  });
}

/** Toggle chips used by the target and batch pickers. */
export function chipList(
  rows: { id: string; label: string; icon?: string; on?: boolean }[],
  attr = "data-toggle",
): string {
  return `<div class="rdpe-dlg-chips">${rows
    .map(
      (r) =>
        `<button type="button" class="rdpe-chip ${r.on ? "on" : ""}" ${attr}="${esc(r.id)}" aria-pressed="${
          r.on ? "true" : "false"
        }">${r.icon ? `<i data-lucide="${esc(r.icon)}"></i>` : ""}${esc(r.label)}</button>`,
    )
    .join("")}</div>`;
}

/** Ids of the chips that are switched on inside a dialog root. */
export function chipValues(root: HTMLElement, attr = "data-toggle"): string[] {
  return Array.from(root.querySelectorAll(`[${attr}].on`)).map(
    (el) => el.getAttribute(attr) as string,
  );
}
