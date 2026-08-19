/**
 * Alert rules.
 *
 * Each rule turns a rolling window of counters into a single, actionable
 * signal. Thresholds are deliberately conservative: an alert that fires on
 * ordinary noise gets muted, and a muted alert is worse than none.
 */

export type AlertKey =
  | "high_failure_rate"
  | "upload_failures"
  | "generation_timeouts"
  | "webhook_failures"
  | "credit_ledger_mismatch"
  | "auth_failures";

export type Severity = "warning" | "critical";

export interface AlertRule {
  key: AlertKey;
  title: string;
  windowMinutes: number;
  /** Minimum sample size before a ratio rule can fire. */
  minSamples: number;
  /** Failure ratio (0-1) or absolute count, depending on `mode`. */
  threshold: number;
  mode: "ratio" | "count";
  severity: Severity;
  runbook: string;
}

export const ALERT_RULES: AlertRule[] = [
  {
    key: "high_failure_rate",
    title: "High Failure Rate",
    windowMinutes: 15,
    minSamples: 20,
    threshold: 0.2,
    mode: "ratio",
    severity: "critical",
    runbook: "docs/OPERATIONS.md#high-failure-rate",
  },
  {
    key: "upload_failures",
    title: "Upload Failures",
    windowMinutes: 15,
    minSamples: 10,
    threshold: 0.25,
    mode: "ratio",
    severity: "critical",
    runbook: "docs/OPERATIONS.md#upload-failures",
  },
  {
    key: "generation_timeouts",
    title: "Generation Timeouts",
    windowMinutes: 30,
    minSamples: 0,
    threshold: 5,
    mode: "count",
    severity: "critical",
    runbook: "docs/OPERATIONS.md#generation-timeouts",
  },
  {
    key: "webhook_failures",
    title: "Webhook Failures",
    windowMinutes: 30,
    minSamples: 0,
    threshold: 3,
    mode: "count",
    severity: "critical",
    runbook: "docs/OPERATIONS.md#webhook-failures",
  },
  {
    key: "credit_ledger_mismatch",
    title: "Credit Ledger Mismatch",
    windowMinutes: 60,
    minSamples: 0,
    threshold: 1,
    mode: "count",
    severity: "critical",
    runbook: "docs/OPERATIONS.md#credit-ledger-mismatch",
  },
  {
    key: "auth_failures",
    title: "Unusual Authentication Failures",
    windowMinutes: 10,
    minSamples: 0,
    threshold: 25,
    mode: "count",
    severity: "warning",
    runbook: "docs/OPERATIONS.md#authentication-failures",
  },
];

export interface WindowCounters {
  /** Total attempts observed in the window (ratio rules only). */
  total?: number;
  /** Failures or events observed in the window. */
  failures: number;
}

export interface AlertEvaluation {
  key: AlertKey;
  title: string;
  firing: boolean;
  severity: Severity;
  value: number;
  threshold: number;
  detail: string;
  runbook: string;
}

export function evaluateAlert(rule: AlertRule, counters: WindowCounters): AlertEvaluation {
  const total = counters.total ?? 0;
  const value = rule.mode === "ratio" ? (total > 0 ? counters.failures / total : 0) : counters.failures;
  const enoughSamples = rule.mode === "ratio" ? total >= rule.minSamples : true;
  const firing = enoughSamples && value >= rule.threshold;
  const detail =
    rule.mode === "ratio"
      ? `${counters.failures}/${total} failed in the last ${rule.windowMinutes} minutes.`
      : `${counters.failures} events in the last ${rule.windowMinutes} minutes.`;
  return {
    key: rule.key,
    title: rule.title,
    firing,
    severity: rule.severity,
    value,
    threshold: rule.threshold,
    detail,
    runbook: rule.runbook,
  };
}

export function evaluateAll(counters: Partial<Record<AlertKey, WindowCounters>>): AlertEvaluation[] {
  return ALERT_RULES.map((rule) => evaluateAlert(rule, counters[rule.key] ?? { failures: 0, total: 0 }));
}
