/**
 * ResultSummaryPanel — shared model + vanilla renderer.
 *
 * One definition of the white result card used across the marketing site and
 * the application. The React component (src/components/ResultSummaryPanel.tsx)
 * and every string-HTML surface (hero tour, studio, previews) render through
 * this file so labels, wording, tone and markup can never drift apart.
 */

export type StatusTone = "positive" | "warning" | "negative" | "neutral" | "processing";

export type SummaryMetric = {
  label: string;
  value: string;
  tone?: StatusTone;
  /** Force plain neutral text (no colored dot). */
  plain?: boolean;
};

export type SummaryModel = {
  /** Small uppercase label above the primary value, e.g. "Room". */
  primaryLabel?: string;
  /** Legacy alias for primaryLabel. */
  contextLabel?: string;
  primaryValue?: string;
  state?: "completed" | "processing" | "error";
  /** Processing headline used as the primary value when state is processing. */
  progressMessage?: string;
  metrics?: SummaryMetric[];
  compact?: boolean;
  flush?: boolean;
};

/** Technical labels shortened to plain language. */
const LABEL_MAP: Record<string, string> = {
  "layout confidence": "Layout",
  "fit confidence": "Confidence",
  "structural changes": "Structure",
  "objects detected": "Objects",
  "objects removed": "Objects",
  "disclosure ready": "Disclosure",
  "room staged": "Staging",
  "product match": "Products Matched",
  "rooms planned": "Rooms",
  "rooms approved": "Rooms",
  "ready to post": "Delivery",
};

/** Bare values completed into self-explaining ones. */
const VALUE_MAP: Record<string, string> = {
  yes: "Ready",
  none: "No Changes",
  "none detected": "No Changes",
  "14 of 14 found": "14 of 14",
};

const POSITIVE = [
  "within target",
  "well within target",
  "approved",
  "ready",
  "no changes",
  "staged",
  "preserved",
  "applied",
  "on",
];
const WARNING = [
  "medium",
  "measuring",
  "scanning",
  "reading",
  "detecting",
  "near target",
  "review",
];
const NEGATIVE = ["over target", "above band", "low", "structural change", "failed"];

export function shortLabel(label: string): string {
  return LABEL_MAP[label.trim().toLowerCase()] ?? label;
}

export function fullValue(value: string): string {
  return VALUE_MAP[value.trim().toLowerCase()] ?? value;
}

export function toneFor(value: string): StatusTone {
  const v = value.trim().toLowerCase();
  if (NEGATIVE.some((n) => v === n || v.includes(n))) return "negative";
  if (WARNING.some((w) => v === w || v.includes(w))) return "warning";
  if (POSITIVE.some((p) => v === p || v.includes(p))) return "positive";
  return "neutral";
}

/** Normalize a raw [label, value] pair coming from call sites. */
export function metric(label: string, value: string, tone?: StatusTone): SummaryMetric {
  const v = fullValue(value);
  return { label: shortLabel(label), value: v, tone: tone ?? toneFor(v) };
}

export function primaryLabelOf(m: SummaryModel): string {
  return m.primaryLabel ?? m.contextLabel ?? "";
}

/** Numbers, ranges and counts stay neutral; only status words take a dot. */
export function showsDot(tone: StatusTone, plain?: boolean): boolean {
  return !plain && tone !== "neutral";
}

function esc(s: string): string {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}

/** Values past this length no longer fit a cell at full size. */
export const LONG_VALUE = 13;

/** Vanilla renderer used by the string-HTML surfaces. */
export function summaryHTML(m: SummaryModel): string {
  const processing = m.state === "processing";
  const cells: string[] = [];

  const value = processing ? (m.progressMessage ?? "Working") : (m.primaryValue ?? "");
  const longPrimary = value.length > LONG_VALUE ? " is-long" : "";
  cells.push(
    `<div class="rsp-col rsp-lead"><span class="rsp-label">${esc(primaryLabelOf(m))}</span>` +
      `<span class="rsp-primary${processing ? " is-processing" : ""}${longPrimary}">${processing ? '<i class="rsp-dot is-processing rsp-live"></i>' : ""}<span class="rsp-text">${esc(value)}</span></span></div>`,
  );

  for (const x of (m.metrics ?? []).slice(0, 3)) {
    const tone = x.tone ?? toneFor(x.value);
    const dot = showsDot(tone, x.plain)
      ? `<i class="rsp-dot is-${tone}${tone === "processing" ? " rsp-live" : ""}"></i>`
      : "";
    const long = x.value.length > LONG_VALUE ? " is-long" : "";
    cells.push(
      `<div class="rsp-col"><span class="rsp-label">${esc(x.label)}</span><span class="rsp-value is-${x.plain ? "neutral" : tone}${long}">${dot}<span class="rsp-text">${esc(x.value)}</span></span></div>`,
    );
  }

  // the tray is always four cells so it never changes shape between states
  while (cells.length < 4) cells.push('<div class="rsp-col" aria-hidden="true"></div>');

  return `<div class="rsp${m.compact ? " rsp-compact" : ""}${m.flush ? " rsp-flush" : ""}" data-state="${processing ? "processing" : (m.state ?? "completed")}">${cells.join("")}</div>`;
}
