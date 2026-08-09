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
  "high confidence": "High",
  "medium confidence": "Medium",
  "low confidence": "Low",
  "14 of 14 found": "14 of 14",
};

const POSITIVE = [
  "within target",
  "well within target",
  "approved",
  "ready",
  "no changes",
  "high",
  "staged",
  "preserved",
  "applied",
  "on",
];
const WARNING = ["medium", "measuring", "scanning", "reading", "detecting", "near target", "review"];
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

/** Vanilla renderer used by the string-HTML surfaces. */
export function summaryHTML(m: SummaryModel): string {
  const processing = m.state === "processing";
  const metrics = (m.metrics ?? [])
    .slice(0, 3)
    .map((x) => {
      const tone = x.tone ?? toneFor(x.value);
      const dot = showsDot(tone, x.plain) ? `<i class="rsp-dot is-${tone}"></i>` : "";
      return `<div class="rsp-col"><span class="rsp-label">${esc(x.label)}</span><span class="rsp-value is-${x.plain ? "neutral" : tone}">${dot}${esc(x.value)}</span></div>`;
    })
    .join("");

  const value = processing ? (m.progressMessage ?? "Working") : (m.primaryValue ?? "");
  const primary =
    `<span class="rsp-label">${esc(primaryLabelOf(m))}</span>` +
    `<span class="rsp-primary${processing ? " is-processing" : ""}">${processing ? '<i class="rsp-dot is-processing rsp-live"></i>' : ""}${esc(value)}</span>`;

  return `<div class="rsp${m.compact ? " rsp-compact" : ""}${m.flush ? " rsp-flush" : ""}" data-state="${processing ? "processing" : (m.state ?? "completed")}">
  <div class="rsp-col rsp-lead">${primary}</div>${metrics}
</div>`;
}
