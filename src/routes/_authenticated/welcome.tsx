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
    <div className="rd-app rd-welcome-page">
      <div className="rd-welcome-shell">
        <div className="rd-welcome-brand">
          <span className="rd-welcome-mark">
            REAL
            <em>DESIGNS</em>
          </span>
          <p className="rd-welcome-kicker">Let’s Set Up Your Workspace</p>
        </div>
        <div className="rd-welcome-card">
          <div ref={host} />
          {!ready ? <p className="sv-hint">Loading…</p> : null}
        </div>
      </div>
    </div>
  );
}
