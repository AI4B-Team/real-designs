import {
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
  const { primaryValue, progressMessage, state = "completed", metrics = [], compact, flush } = model;
  const processing = state === "processing";
  const value = processing ? (progressMessage ?? "Working") : (primaryValue ?? "");

  return (
    <div
      className={`rsp${compact ? " rsp-compact" : ""}${flush ? " rsp-flush" : ""}`}
      data-state={state}
    >
      <div className="rsp-col rsp-lead">
        <span className="rsp-label">{primaryLabelOf(model)}</span>
        <span className={`rsp-primary${processing ? " is-processing" : ""}`}>
          {processing ? <i className="rsp-dot is-processing rsp-live" /> : null}
          {value}
        </span>
      </div>
      {metrics.slice(0, 3).map((m: SummaryMetric) => {
        const tone = m.tone ?? toneFor(m.value);
        return (
          <div className="rsp-col" key={m.label}>
            <span className="rsp-label">{m.label}</span>
            <span className={`rsp-value is-${m.plain ? "neutral" : tone}`}>
              {showsDot(tone, m.plain) ? <i className={`rsp-dot is-${tone}`} /> : null}
              {m.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default ResultSummaryPanel;
