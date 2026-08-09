import { useState } from "react";

import { ResultSummaryPanel } from "@/components/ResultSummaryPanel";
import { metric } from "@/lib/result-summary";
import {
  estimate,
  fmt,
  GRADES,
  ROOMS,
  type FinishGrade,
  type RoomKey,
} from "@/lib/planning-range";


/**
 * Works with no image, no account and no server call: typed dimensions times
 * published unit rates. The output is a planning range, never a bid.
 */
export function RehabCalculator({ defaultRoom = "kitchen" as RoomKey }) {
  const [room, setRoom] = useState<RoomKey>(defaultRoom);
  const [sf, setSf] = useState<number>(ROOMS.find((r) => r.key === defaultRoom)?.defaultSf ?? 180);
  const [grade, setGrade] = useState<FinishGrade>("retail");

  const result = estimate(room, sf, grade);

  return (
    <div className="builder calc" id="builder">
      <div className="builder-title">
        <h3>Rehab Cost Calculator</h3>
        <p>Pick a room, type its size, choose a finish grade. No photo and no account required.</p>
      </div>

      <div className="builder-step">
        <div className="step-lab">
          <i>1</i>What Are You Pricing?
        </div>
        <div className="chips">
          {ROOMS.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`chip${room === r.key ? " on" : ""}`}
              onClick={() => {
                setRoom(r.key);
                setSf(r.defaultSf);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="builder-step">
        <div className="step-lab">
          <i>2</i>How Big Is It?
        </div>
        <div className="calc-field">
          <input
            type="number"
            min={20}
            max={12000}
            value={sf}
            onChange={(e) => setSf(Number(e.target.value))}
            aria-label="Floor area in square feet"
          />
          <span className="mono">Square Feet</span>
        </div>
        <input
          className="calc-range"
          type="range"
          min={20}
          max={room === "wholeHome" || room === "landscape" ? 4000 : 800}
          step={5}
          value={Math.min(sf, room === "wholeHome" || room === "landscape" ? 4000 : 800)}
          onChange={(e) => setSf(Number(e.target.value))}
          aria-label="Adjust floor area"
        />
      </div>

      <div className="builder-step" style={{ marginBottom: 14 }}>
        <div className="step-lab">
          <i>3</i>Which Finish Grade?
        </div>
        <div className="chips">
          {GRADES.map((g) => (
            <button
              key={g.key}
              type="button"
              className={`chip budget${grade === g.key ? " on" : ""}`}
              onClick={() => setGrade(g.key)}
            >
              <b>{g.label}</b>
              <span>{g.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="out on" style={{ display: "block" }}>
        <ResultSummaryPanel
          primaryLabel="Estimated Planning Range"
          primaryValue={`${fmt(result.totalLow)}–${fmt(result.totalHigh)}`}
          compact
          metrics={[
            metric("Pricing", result.confidence),
            { label: "Line Items", value: String(result.lines.length), plain: true },
            { label: "Basis", value: "Planning Estimate", plain: true },
          ]}
        />

        <table className="lp-table calc-table">
          <thead>
            <tr>
              <th>Line Item</th>
              <th className="mono">Qty</th>
              <th className="mono">Range</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((l) => (
              <tr key={l.item}>
                <td>{l.item}</td>
                <td className="mono">{l.qty}</td>
                <td className="mono">
                  {fmt(l.low)} to {fmt(l.high)}
                </td>
              </tr>
            ))}
            <tr className="calc-sub">
              <td>Contingency, {result.contingencyPct} Percent</td>
              <td className="mono">1 LS</td>
              <td className="mono">
                {fmt(result.totalLow - result.subtotalLow)} to{" "}
                {fmt(result.totalHigh - result.subtotalHigh)}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="lp-basis mono">
          {fmt(result.perSfLow)} to {fmt(result.perSfHigh)} per square foot. Planning range from
          published unit rates and typed dimensions. Not a bid and not an engineering
          determination.
        </p>
      </div>
    </div>
  );
}
