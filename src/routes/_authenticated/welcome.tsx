import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import "@/styles/rd-app.css";

const title = "Welcome | REAL DESIGNS";
const description = "Answer a few quick questions so REAL DESIGNS can set up your workspace.";

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let alive = true;
    (async () => {
      const mod = await import("@/lib/rd-survey-ui");
      const { row, seed } = await mod.loadSurveySeed();
      if (!alive) return;
      const editing = new URLSearchParams(window.location.search).has("edit");
      if (!editing && row && (row.completed || row.skipped)) {
        navigate({ to: "/app", replace: true });
        return;
      }
      setReady(true);
      if (!host.current) return;
      stop = mod.mountSignupSurvey(host.current, {
        seed,
        onDone: () => navigate({ to: "/app", replace: true }),
      });
    })();
    return () => {
      alive = false;
      stop?.();
    };
  }, [navigate]);

  return (
    <main className="rd-auth rd-welcome">
      <aside className="promo">
        <a href="/" className="brand" aria-label="REAL DESIGNS Home">
          <span className="rd-mark">
            <i>
              <b>REAL</b>
              <em>Designs</em>
            </i>
          </span>
        </a>
        <h2>
          Welcome To REAL DESIGNS.
          <br />
          Let’s Tune Your Workspace.
        </h2>
        <p className="sub">
          A few quick questions so your studio, credits and templates match the way you work.
        </p>
        <ul>
          <li>
            <span className="n">1</span>
            <span>
              <b>Tell Us Who You Are</b>
              Your name and company appear on shared links.
            </span>
          </li>
          <li>
            <span className="n">2</span>
            <span>
              <b>Share How You Work</b>
              Role, listing volume and team size shape your defaults.
            </span>
          </li>
          <li>
            <span className="n">3</span>
            <span>
              <b>Start Designing</b>
              Land straight in Studio with everything ready.
            </span>
          </li>
        </ul>
        <p className="quote">Takes About 30 Seconds · You Can Change Answers Anytime</p>
      </aside>

      <div className="panel">
        <div className="mobile-head">
          <h2>Welcome To REAL DESIGNS</h2>
          <p>A Few Quick Questions To Set Up Your Workspace.</p>
        </div>
        <section className="rd-app rd-welcome-card">
          <div ref={host} />
          {!ready ? <p className="sv-hint">Loading…</p> : null}
        </section>
      </div>
    </main>
  );
}
