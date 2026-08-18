/* Shared builder exit behaviour.
 *
 * Both builders (Photo Design and Video) offer the same two ways out of a
 * project: "Save & Exit" and "Start Over". The wording, the confirmation
 * dialog and the Studio reset live here so the two workflows can never drift.
 */
/* eslint-disable */
// @ts-nocheck

export const EXIT_LABELS = {
  save: "Save & Exit",
  startOver: "Start Over",
  keep: "Keep Editing",
  confirm: "Save Draft & Start Over",
};

/** Return Studio to its initial, unselected state before a new project. */
export function resetStudioSurface() {
  try {
    (window as any).rdClearStudioSource && (window as any).rdClearStudioSource();
  } catch (_) {}
}

/** Navigate to the main Studio starting page. */
export function goStudio(go?: (v: string) => void) {
  const fn = go || (typeof window !== "undefined" ? (window as any).__rdGo : null);
  try {
    if (fn) fn("studio");
    else if (typeof location !== "undefined") location.hash = "#studio";
  } catch (_) {}
}

/** The one Start Over confirmation used by both builders. */
export function startOverModalHtml(ids: { wrap?: string; keep: string; go: string; busy?: boolean } ) {
  return `<div class="rv-modal on" id="${ids.wrap || "rdStartOverWrap"}"><div class="rv-modal-in" role="dialog" aria-label="Start over">
    <div class="rv-modal-h"><b>Start over?</b></div>
    <div class="rv-modal-b"><p>Your current project is saved as a draft. Starting over will return you to Studio so you can begin a new project.</p></div>
    <div class="rv-modal-f">
      <button class="btn btn-ghost" id="${ids.keep}">${EXIT_LABELS.keep}</button>
      <button class="btn btn-primary" id="${ids.go}"${ids.busy ? " disabled" : ""}>${ids.busy ? "Saving…" : EXIT_LABELS.confirm}</button>
    </div>
  </div></div>`;
}

/* ------------------------------------------------------- browser history */

/* Browser Back steps through the builder rather than dumping the project.
   The builder pushes one history entry per step; Back inside those entries
   moves a step back, and Back from the first step asks before leaving. */
const H: any = { key: null, step: null, handlers: null };

export function trackBuilderStep(key: string, step: any, handlers: { onStep?: (s: any) => void; onExit?: () => void }) {
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
  } catch (_) {}
}

export function endBuilderHistory(key: string) {
  if (H.key === key) {
    H.key = null;
    H.step = null;
    H.handlers = null;
  }
}

if (typeof window !== "undefined" && !(window as any).__rdBuilderHistory) {
  (window as any).__rdBuilderHistory = true;
  window.addEventListener("popstate", (e: any) => {
    if (!H.key || !H.handlers) return;
    const st = e.state && e.state.rdb === H.key ? e.state : null;
    if (st) {
      H.step = st.rdbStep;
      try {
        H.handlers.onStep && H.handlers.onStep(st.rdbStep);
      } catch (_) {}
      return;
    }
    /* Back out of the builder's own entries: confirm instead of discarding,
       and put the user back where they were. */
    try {
      const stay = H.handlers.onExit && H.handlers.onExit();
      if (stay !== false) history.pushState({ rdb: H.key, rdbStep: H.step }, "");
    } catch (_) {}
  });
}
