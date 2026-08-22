/**
 * The shared Design Canvas status badge.
 *
 * One badge, one style, one position for every Designer tool (Redesign,
 * Stage, Declutter, Edit, ...). The badge always describes the image that is
 * currently on screen — never the tool that happens to be selected.
 */

export type CanvasBadgeState = "original" | "edited" | "generated" | "saving" | "save-failed";

export const CANVAS_BADGE_LABEL: Record<CanvasBadgeState, string> = {
  original: "Original",
  edited: "Edited",
  generated: "Generated",
  saving: "Saving…",
  "save-failed": "Save Failed",
};

/** Only a genuine failure is allowed to speak in red. */
export function badgeIsError(state: CanvasBadgeState): boolean {
  return state === "save-failed";
}

export type BadgeInputs = {
  /** The user is holding Compare, so the unmodified source is on screen. */
  comparing?: boolean;
  saving?: boolean;
  saveFailed?: boolean;
  /** An adjustment, crop or AI preview is visible on the displayed image. */
  hasEdits?: boolean;
  /** The displayed image came out of a generation, not a camera. */
  generated?: boolean;
};

/**
 * Resolves what the displayed image is. Compare always shows the untouched
 * source, so it always reads "Original".
 */
export function resolveCanvasBadge(i: BadgeInputs): CanvasBadgeState {
  if (i.saving) return "saving";
  if (i.saveFailed) return "save-failed";
  if (i.comparing) return "original";
  if (i.hasEdits) return "edited";
  if (i.generated) return "generated";
  return "original";
}

/**
 * Comparing the source photo with itself tells the user nothing, so the
 * control is hidden until an edit actually exists.
 */
export function showCompareControl(hasEdits: boolean): boolean {
  return !!hasEdits;
}

/** Design tokens for the badge, exported so tests can assert contrast. */
export const CANVAS_BADGE_TOKENS = {
  background: "rgba(15, 15, 15, 0.88)",
  color: "#ffffff",
  errorColor: "#ff6b6b",
  borderColor: "rgba(255, 255, 255, 0.18)",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: "0.06em",
  minHeight: 28,
  paddingX: 12,
  borderRadius: 999,
} as const;

/** Paints a badge element for a state. Safe to call with a missing element. */
export function applyCanvasBadge(el: Element | null, state: CanvasBadgeState) {
  if (!el) return;
  el.textContent = CANVAS_BADGE_LABEL[state];
  el.setAttribute("data-badge", state);
  el.classList.toggle("is-error", badgeIsError(state));
  (el as HTMLElement).hidden = false;
}
