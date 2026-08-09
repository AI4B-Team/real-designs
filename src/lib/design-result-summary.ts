/**
 * DesignResultSummary — shared model + vanilla renderer.
 *
 * One definition of the dark result panel. The React component
 * (src/components/DesignResultSummary.tsx) and every string-HTML surface
 * (marketing hero tour, studio, previews) both go through this file so the
 * labels, wording, pill semantics and markup can never drift apart.
 */

export type StatusTone = "positive" | "warning" | "negative" | "neutral" | "processing";

export type SummaryMetric = {
  label: string;
  value: string;
  tone?: StatusTone;
  /** Render as plain text rather than a pill. */
  plain?: boolean;
};

export type SummaryModel = {
  contextLabel: string;
  primaryValue?: string;
  /** Shown under the primary value on completed panels. */
  primarySub?: string;
  state?: "completed" | "processing" | "error";
  /** Processing headline, e.g. "Detecting contents…" */
  progressMessage?: string;
  /** Processing detail line, e.g. "14 objects found" */
  progressDetail?: string;
  metrics?: SummaryMetric[];
  compact?: boolean;
  flush?: boolean;
};

/** Technical labels shortened to plain language. */
const LABEL_MAP: Record<string, string> = {
  "layout confidence": "Layout",
  "pricing confidence": "Pricing",
  "fit confidence": "Confidence",
  "structural changes": "Structure",
  "objects detected": "Objects",
  "objects removed": "Objects",
  "disclosure ready": "Disclosure",
  "room staged": "Staging",
  "product match": "Products",
  "rooms planned": "Rooms",
  "rooms approved": "Rooms",
  "ready to post": "Delivery",
};

/** Bare values completed into self-explaining ones. */
const VALUE_MAP: Record<string, string> = {
  high: "High Confidence",
  medium: "Medium Confidence",
  low: "Low Confidence",
  yes: "Ready",
  none: "No Changes",
  "none detected": "No Changes",
};

const POSITIVE = [
  "within target",
  "well within target",
  "approved",
  "ready",
  "no changes",
  "high confidence",
  "staged",
  "preserved",
  "applied",
  "found",
];
const WARNING = [
  "medium confidence",
  "measuring",
  "scanning",
  "reading",
  "detecting",
  "near target",
  "review",
];
const NEGATIVE = ["over target", "above band", "low confidence", "structural change", "failed"];

export function shortLabel(label: string): string {
  return LABEL_MAP[label.trim().toLowerCase()] ?? label;
}

export function fullValue(value: string): string {
  return VALUE_MAP[value.trim().toLowerCase()] ?? value;
}

export function toneFor(value: string): StatusTone {
  const v = value.trim().toLowerCase();
  if (v === "on") return "positive";
  if (NEGATIVE.some((n) => v.includes(n))) return "negative";
  if (WARNING.some((w) => v.includes(w))) return "warning";
  if (POSITIVE.some((p) => v.includes(p))) return "positive";
  return "neutral";
}

/** Normalize a raw [label, value] pair coming from legacy call sites. */
export function metric(label: string, value: string, tone?: StatusTone): SummaryMetric {
  const v = fullValue(value);
  return { label: shortLabel(label), value: v, tone: tone ?? toneFor(v) };
}

export function pillClass(tone: StatusTone): string {
  return `rds-pill is-${tone}`;
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
    .map((x) => {
      const tone = x.tone ?? toneFor(x.value);
      const body = x.plain
        ? `<span class="rds-metric-value">${esc(x.value)}</span>`
        : `<span class="${pillClass(tone)}">${esc(x.value)}</span>`;
      return `<div class="rds-metric"><span class="rds-label">${esc(x.label)}</span>${body}</div>`;
    })
    .join("");

  const primary = processing
    ? `<span class="rds-progress"><span class="rds-spinner"></span>${esc(m.progressMessage ?? "Working…")}</span>` +
      (m.progressDetail ? `<span class="rds-sub">${esc(m.progressDetail)}</span>` : "")
    : `<b class="rds-value">${esc(m.primaryValue ?? "")}</b>` +
      (m.primarySub ? `<span class="rds-sub">${esc(m.primarySub)}</span>` : "");

  return `<div class="rds${m.compact ? " rds-compact" : ""}${m.flush ? " rds-flush" : ""}" data-state="${processing ? "processing" : (m.state ?? "completed")}">
  <div class="rds-primary"><span class="rds-context">${esc(m.contextLabel)}</span>${primary}</div>
  <div class="rds-metrics">${metrics}</div>
</div>`;
}
