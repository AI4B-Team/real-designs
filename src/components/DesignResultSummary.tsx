import {
  pillClass,
  toneFor,
  type SummaryMetric,
  type SummaryModel,
  type StatusTone,
} from "@/lib/design-result-summary";

/** The one semantic status pill used everywhere. */
export function StatusPill({ value, tone }: { value: string; tone?: StatusTone }) {
  return <span className={pillClass(tone ?? toneFor(value))}>{value}</span>;
}

/**
 * DesignResultSummary — the shared dark "project intelligence" panel.
 * Markup and tokens are shared with the vanilla renderer in
 * src/lib/design-result-summary.ts. Never fork this panel per page.
 */
export function DesignResultSummary({
  contextLabel,
  primaryValue,
  primarySub,
  state = "completed",
  progressMessage,
  progressDetail,
  metrics = [],
  compact,
  flush,
}: SummaryModel) {
  const processing = state === "processing";
  return (
    <div
      className={`rds${compact ? " rds-compact" : ""}${flush ? " rds-flush" : ""}`}
      data-state={state}
    >
      <div className="rds-primary">
        <span className="rds-context">{contextLabel}</span>
        {processing ? (
          <>
            <span className="rds-progress">
              <span className="rds-spinner" />
              {progressMessage ?? "Working…"}
            </span>
            {progressDetail ? <span className="rds-sub">{progressDetail}</span> : null}
          </>
        ) : (
          <>
            <b className="rds-value">{primaryValue}</b>
            {primarySub ? <span className="rds-sub">{primarySub}</span> : null}
          </>
        )}
      </div>
      <div className="rds-metrics">
        {metrics.map((m: SummaryMetric) => (
          <div className="rds-metric" key={m.label}>
            <span className="rds-label">{m.label}</span>
            {m.plain ? (
              <span className="rds-metric-value">{m.value}</span>
            ) : (
              <StatusPill value={m.value} {...(m.tone ? { tone: m.tone } : {})} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DesignResultSummary;
