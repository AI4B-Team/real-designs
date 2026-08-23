/* Shared builder exit behaviour.
 *
 * Both builders (Photo Design and Video) offer the same two ways out of a
 * project: "Save & Exit" and "Start Over". The wording, the confirmation
 * dialog and the Studio reset live here so the two workflows can never drift.
 */
/* eslint-disable */
// @ts-nocheck
import { STUDIO_HASH } from "@/lib/studio-context";

export const EXIT_LABELS = {
  save: "Save & Exit",
  startOver: "Start Over",
  keep: "Keep Editing",
  confirm: "Start Over",
};

/**
 * Return Studio to its initial, unselected state before a new project.
 *
 * A reset is destructive: it throws away the photo, the result and the room
 * context on the Canvas. It therefore only runs on an explicit user exit
 * (`force`). Housekeeping paths — an empty legacy step, a builder unmounting
 * itself — must never bounce a live Canvas session back to the start page.
 */
export function resetStudioSurface(opts?: { force?: boolean }) {
  try {
    const w = window as any;
    if (!opts?.force && w.rdStudioHasSource && w.rdStudioHasSource()) return false;
    w.rdClearStudioSource && w.rdClearStudioSource();
    return true;
  } catch (_) {
    return false;
  }
}

/** Navigate to the main Studio starting page, on the canonical route. */
export function goStudio(go?: (v: string) => void) {
  const fn = go || (typeof window !== "undefined" ? (window as any).__rdGo : null);
  try {
    /* Leaving a builder always ends any Photo Design Canvas context. */
    (window as any).__rdClearStudioMode && (window as any).__rdClearStudioMode();
  } catch (_) {}
  try {
    if (fn) fn("studio");
    else if (typeof location !== "undefined") location.hash = STUDIO_HASH;
  } catch (_) {}
}

/** The one Start Over confirmation used by both builders. */
export function startOverModalHtml(ids: {
  wrap?: string;
  keep: string;
  go: string;
  busy?: boolean;
}) {
  return `<div class="rv-modal on" id="${ids.wrap || "rdStartOverWrap"}"><div class="rv-modal-in" role="dialog" aria-label="Start over">
    <div class="rv-modal-h"><b>Start over?</b></div>
    <div class="rv-modal-b"><p>Your current draft settings will be cleared. Uploaded photos will remain in Media.</p></div>
    <div class="rv-modal-f">
      <button class="btn btn-ghost" id="${ids.keep}">${EXIT_LABELS.keep}</button>
      <button class="btn btn-danger" id="${ids.go}"${ids.busy ? " disabled" : ""}>${ids.busy ? "Clearing…" : EXIT_LABELS.confirm}</button>
    </div>
  </div></div>`;
}

/* ------------------------------------------------------- browser history */

/* Browser Back steps through the builder rather than dumping the project.
   The builder pushes one history entry per step; Back inside those entries
   moves a step back, and Back from the first step asks before leaving. */
const H: any = { key: null, step: null, handlers: null, len: 0 };

export function trackBuilderStep(
  key: string,
  step: any,
  handlers: { onStep?: (s: any) => void; onExit?: () => void },
) {
  if (typeof history === "undefined") return;
  H.key = key;
  H.handlers = handlers;
  if (H.step === step) return;
  const first = H.step == null;
  H.step = step;
  try {
    const state = { rdb: key, rdbStep: step };
    if (first) history.replaceState({ ...(history.state || {}), ...state }, "");
    else history.pushState(state, "");
    H.len = history.length;
  } catch (_) {}
}

export function endBuilderHistory(key: string) {
  if (H.key === key) {
    H.key = null;
    H.step = null;
    H.handlers = null;
    H.len = 0;
  }
}

if (typeof window !== "undefined" && !(window as any).__rdBuilderHistory) {
  (window as any).__rdBuilderHistory = true;
  window.addEventListener("popstate", (e: any) => {
    if (!H.key || !H.handlers) return;
    const st = e.state && e.state.rdb === H.key ? e.state : null;
    if (st) {
      H.step = st.rdbStep;
      H.len = typeof history !== "undefined" ? history.length : H.len;
      try {
        H.handlers.onStep && H.handlers.onStep(st.rdbStep);
      } catch (_) {}
      return;
    }
    /* Browsers also fire popstate for a forward same-document hash navigation
       (`location.hash = "#v-explore"`), which is the shell routing somewhere
       else — not the user pressing Back. A forward navigation adds a history
       entry, so only a stack that did not grow can be a real Back. */
    try {
      if (typeof history !== "undefined" && history.length > H.len) {
        H.key = null;
        H.step = null;
        H.handlers = null;
        H.len = 0;
        return;
      }
    } catch (_) {}
    /* Back out of the builder's own entries: confirm instead of discarding,
       and put the user back where they were. */
    try {
      const stay = H.handlers.onExit && H.handlers.onExit();
      if (stay !== false) history.pushState({ rdb: H.key, rdbStep: H.step }, "");
    } catch (_) {}
  });
}

