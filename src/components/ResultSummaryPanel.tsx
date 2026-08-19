import {
  LONG_VALUE,
  primaryLabelOf,
  showsDot,
  toneFor,
  type SummaryMetric,
  type SummaryModel,
} from "@/lib/result-summary";

/**
 * ResultSummaryPanel — the one white result card used everywhere.
 * Markup and tokens are shared with the vanilla renderer in
 * src/lib/result-summary.ts. Never fork this panel per page.
 */
export function ResultSummaryPanel(model: SummaryModel) {
  const {
    primaryValue,
    progressMessage,
    state = "completed",
    metrics = [],
    compact,
    flush,
  } = model;
  const processing = state === "processing";
  const value = processing ? (progressMessage ?? "Working") : (primaryValue ?? "");

  return (
    <div
      className={`rsp${compact ? " rsp-compact" : ""}${flush ? " rsp-flush" : ""}`}
      data-state={state}
    >
      <div className="rsp-col rsp-lead">
        <span className="rsp-label">{primaryLabelOf(model)}</span>
        <span
          className={`rsp-primary${processing ? " is-processing" : ""}${value.length > LONG_VALUE ? " is-long" : ""}`}
        >
          {processing ? <i className="rsp-dot is-processing rsp-live" /> : null}
          <span className="rsp-text">{value}</span>
        </span>
      </div>
      {metrics.slice(0, 3).map((m: SummaryMetric) => {
        const tone = m.tone ?? toneFor(m.value);
        return (
          <div className="rsp-col" key={m.label}>
            <span className="rsp-label">{m.label}</span>
            <span
              className={`rsp-value is-${m.plain ? "neutral" : tone}${m.value.length > LONG_VALUE ? " is-long" : ""}`}
            >
              {showsDot(tone, m.plain) ? (
                <i className={`rsp-dot is-${tone}${tone === "processing" ? " rsp-live" : ""}`} />
              ) : null}
              <span className="rsp-text">{m.value}</span>
            </span>
          </div>
        );
      })}

      {/* the tray is always four cells so it never changes shape between states */}
      {Array.from({ length: Math.max(0, 3 - metrics.slice(0, 3).length) }).map((_, i) => (
        <div className="rsp-col" aria-hidden="true" key={`pad-${i}`} />
      ))}
    </div>
  );
}

export default ResultSummaryPanel;
