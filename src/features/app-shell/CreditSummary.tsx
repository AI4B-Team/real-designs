import { memo } from "react";

/**
 * Credit meter in the sidebar footer.
 *
 * Values are still written by the workspace loader in rd-app-script through
 * the `credLab` id; this component owns the markup only.
 */
export const CreditSummary = memo(function CreditSummary() {
  return (
    <div className="credit-box">
      <div className="lab">
        <span>Credits</span>
        <b id="credLab">&mdash;</b>
      </div>
      <div className="meter">
        <i style={{ width: "0%" }} />
      </div>
      <div className="lab" style={{ margin: "8px 0 0" }}>
        <span>Loading Plan</span>
        <b />
      </div>
    </div>
  );
});
