import { useState } from "react";

import { estimateArv, fmt } from "@/lib/planning-range";
import { DesignResultSummary } from "@/components/DesignResultSummary";

const CONDITIONS = [
  { key: "dated" as const, label: "Dated", note: "Sound but old finishes" },
  { key: "worn" as const, label: "Worn", note: "Tired, some damage" },
  { key: "distressed" as const, label: "Distressed", note: "Vacant or unlivable" },
];

/**
 * ARV impact range. No image, no account, no server call. Deliberately
 * conservative recoup multiples, capped by the comp ceiling when one is typed.
 */
export function ArvCalculator() {
  const [asIs, setAsIs] = useState(240000);
  const [rehab, setRehab] = useState(45000);
  const [condition, setCondition] = useState<"dated" | "worn" | "distressed">("worn");
  const [comp, setComp] = useState(0);

  const r = estimateArv({ asIs, rehab, condition, compCeiling: comp });

  return (
    <div className="builder calc" id="builder">
      <div className="builder-title">
        <h3>ARV Calculator</h3>
        <p>
          Type the as-is value and the rehab budget. No photo and no account required. The output
          is a range, because a single ARV number is a guess wearing a suit.
        </p>
      </div>

      <div className="builder-step">
        <div className="step-lab">
          <i>1</i>As-Is Value Or Purchase Price
        </div>
        <div className="calc-field">
          <span className="mono">$</span>
          <input
            type="number"
            min={0}
            step={1000}
            value={asIs}
            onChange={(e) => setAsIs(Number(e.target.value))}
            aria-label="As-is value"
          />
        </div>
      </div>

      <div className="builder-step">
        <div className="step-lab">
          <i>2</i>Planned Rehab Budget
        </div>
        <div className="calc-field">
          <span className="mono">$</span>
          <input
            type="number"
            min={0}
            step={1000}
            value={rehab}
            onChange={(e) => setRehab(Number(e.target.value))}
            aria-label="Rehab budget"
          />
        </div>
        <input
          className="calc-range"
          type="range"
          min={0}
          max={200000}
          step={1000}
          value={Math.min(rehab, 200000)}
          onChange={(e) => setRehab(Number(e.target.value))}
          aria-label="Adjust rehab budget"
        />
      </div>

      <div className="builder-step">
        <div className="step-lab">
          <i>3</i>Condition Today
        </div>
        <div className="chips">
          {CONDITIONS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`chip budget${condition === c.key ? " on" : ""}`}
              onClick={() => setCondition(c.key)}
            >
              <b>{c.label}</b>
              <span>{c.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="builder-step" style={{ marginBottom: 14 }}>
        <div className="step-lab">
          <i>4</i>Best Comparable Sale, Optional
        </div>
        <div className="calc-field">
          <span className="mono">$</span>
          <input
            type="number"
            min={0}
            step={1000}
            value={comp || ""}
            placeholder="Highest recent sale on the street"
            onChange={(e) => setComp(Number(e.target.value))}
            aria-label="Comparable sale ceiling"
          />
        </div>
      </div>

      <div className="out on" style={{ display: "block" }}>
        <DesignResultSummary
          contextLabel="ARV Impact Range"
          primaryValue={`${fmt(r.arvLow)} to ${fmt(r.arvHigh)}`}
          compact
          metrics={[
            {
              label: "Recoup On Rehab",
              value: `${r.recoupLow} to ${r.recoupHigh} percent`,
              tone: "positive" as const,
            },
          ]}
        />

        <table className="lp-table calc-table">
          <tbody>
            <tr>
              <td>Value Added By The Work</td>
              <td className="mono">
                {fmt(r.liftLow)} to {fmt(r.liftHigh)}
              </td>
            </tr>
            <tr>
              <td>Maximum Offer At The 70 Percent Rule</td>
              <td className="mono">{fmt(r.maxOffer)}</td>
            </tr>
            <tr>
              <td>Rehab Budget Entered</td>
              <td className="mono">{fmt(rehab)}</td>
            </tr>
          </tbody>
        </table>

        <p className="lp-basis mono">
          {r.cappedByComps
            ? "Capped by the comparable sale you entered. A street has a ceiling and no renovation moves it far."
            : "Enter a comparable sale to cap the range at what the street actually supports."}{" "}
          Planning range only. Not an appraisal, not a valuation and not a bid.
        </p>
      </div>
    </div>
  );
}
