import { useEffect, useRef, useState } from "react";

import { PHOTOS } from "@/content/rd-photos";
import type { FinishGrade } from "@/lib/planning-range";

const BANDS = [
  { label: "Refresh", note: "Finishes and decor · under $5K", grade: "rental" as FinishGrade },
  { label: "Makeover", note: "Furniture and materials · under $15K", grade: "retail" as FinishGrade },
  {
    label: "Renovation",
    note: "Cabinetry and built-ins · under $35K",
    grade: "retail" as FinishGrade,
  },
  { label: "Reimagine", note: "Layout changes · $35K plus", grade: "premium" as FinishGrade },
];

const SPACES = [
  { key: "interior", label: "Interior" },
  { key: "exterior", label: "Exterior" },
  { key: "landscape", label: "Landscape" },
] as const;

const STEP_TEXT = [
  "Reading room geometry",
  "Locking walls, windows and doors",
  "Selecting materials and finishes",
  "Pricing the scope against local rates",
];

type Props = {
  spaceType: "interior" | "exterior" | "landscape";
  roomType: string;
  budgetBand: 0 | 1 | 2 | 3;
  afterPhoto: string;
  title?: string;
  /** Free tool pages skip the account nudge in the button copy. */
  variant?: "landing" | "free";
};

/**
 * Server-rendered builder. The markup is present in the HTML source; the
 * interactions light up after hydration. Prefilled per landing page.
 */
export function Builder({
  spaceType,
  roomType,
  budgetBand,
  afterPhoto,
  title = "Start Redesigning Your Space",
  variant = "landing",
}: Props) {
  const [space, setSpace] = useState<string>(spaceType);
  const [band, setBand] = useState<number>(budgetBand);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [pct, setPct] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function run() {
    if (phase === "running") return;
    setPhase("running");
    setPct(0);
    let p = 0;
    timer.current = setInterval(() => {
      p += 4 + Math.round(p / 12);
      if (p >= 100) {
        p = 100;
        if (timer.current) clearInterval(timer.current);
        setPhase("done");
      }
      setPct(p);
    }, 90);
  }

  return (
    <div className="builder" id="builder">
      <div className="builder-title">
        <h3>{title}</h3>
        <p>
          Reality Lock keeps your walls, windows and layout exactly where they are. Only the design
          changes.
        </p>
      </div>

      <div className="builder-step">
        <div className="step-lab">
          <i>1</i>Upload Your Space
        </div>
        <label className="drop" htmlFor="lp-file">
          <b>Drag A Photo Or Browse</b>
          <span>JPG, PNG, HEIC. A phone shot works fine.</span>
        </label>
        <input id="lp-file" type="file" accept="image/*" style={{ display: "none" }} />
      </div>

      <div className="builder-step">
        <div className="step-lab">
          <i>2</i>What Are You Redesigning?
        </div>
        <div className="chips">
          {SPACES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`chip${space === s.key ? " on" : ""}`}
              onClick={() => setSpace(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="builder-step" style={{ marginBottom: 14 }}>
        <div className="step-lab">
          <i>3</i>How Far Are You Going?
        </div>
        <div className="chips">
          {BANDS.map((b, i) => (
            <button
              key={b.label}
              type="button"
              className={`chip budget${band === i ? " on" : ""}`}
              onClick={() => setBand(i)}
            >
              <b>{b.label}</b>
              <span>{b.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`out${phase !== "idle" ? " on" : ""}`} style={{ display: phase === "idle" ? "none" : "block" }}>
        <div className="out-stage">
          <div
            className="out-img"
            style={{
              backgroundImage: `url(${phase === "done" ? afterPhoto : PHOTOS.before})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: phase === "done" ? "none" : "blur(6px)",
            }}
          />
          <div className="wm on">
            <span>REAL DESIGNS</span>
          </div>
          {phase === "running" && (
            <div className="genov on">
              <div>
                <div className="mono" style={{ fontSize: ".8rem", fontWeight: 500 }}>
                  Generating Your Design
                </div>
                <div className="bar">
                  <i style={{ width: `${pct}%` }} />
                </div>
                <div
                  className="mono"
                  style={{ fontSize: ".72rem", color: "var(--mute)", marginTop: 10 }}
                >
                  {STEP_TEXT[Math.min(STEP_TEXT.length - 1, Math.floor(pct / 26))]}
                </div>
              </div>
            </div>
          )}
        </div>

        {phase === "done" && (
          <p className="lp-basis mono" style={{ marginTop: 14 }}>
            AI redesign preview only. Photo-to-budget and contractor scope generation are paused
            pending verified local cost data. Use the free calculators for a planning range.
          </p>
        )}
      </div>

      <div className="builder-foot">
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={run}>
          {phase === "done" ? "Generate Another Direction" : "Generate My Design"}
        </button>
        <p className="no-card">
          {variant === "free"
            ? "1 Free Design · No Credit Card · No Account"
            : "1 Free Design · No Credit Card · No Account"}
        </p>
      </div>
    </div>
  );
}
