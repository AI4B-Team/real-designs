import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { LegalDoc, type LegalDocSection } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "System Status | REAL DESIGNS";
const DESC =
  "Live availability of REAL DESIGNS design generation, storage, billing and sign in, plus how we communicate incidents and maintenance.";

export const Route = createFileRoute("/status")({
  head: () => pageHead("/status", TITLE, DESC),
  component: StatusPage,
});

type LiveProvider = { key: string; name: string; state: string; critical: boolean };
type LiveHealth = { status: string; checkedAt: string; providers: LiveProvider[] };

const STATE_LABEL: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded Performance",
  down: "Outage",
  not_configured: "Not Enabled",
};

function StatusPage() {
  const [health, setHealth] = useState<LiveHealth | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/public/health", { headers: { Accept: "application/json" } });
        const data = (await res.json()) as LiveHealth;
        if (!alive) return;
        setHealth(data);
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      }
    };
    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const componentsSection: LegalDocSection = health
    ? {
        id: "components",
        h2: "Components",
        body: [
          `Live check at ${new Date(health.checkedAt).toLocaleString()}. This section is read directly from our production health check and refreshes every minute.`,
        ],
        bullets: health.providers.map((p) => `${p.name}: ${STATE_LABEL[p.state] ?? p.state}`),
      }
    : {
        id: "components",
        h2: "Components",
        body: [
          failed
            ? "We could not reach our health check just now, so component state is unavailable. Treat this page as informational until the check reports again."
            : "Checking live component state…",
        ],
      };

  const lede = health
    ? health.status === "operational"
      ? "All systems operational, checked live against production."
      : health.status === "degraded"
        ? "Some components are degraded. Details below are checked live against production."
        : "We are experiencing an outage affecting core components. Details below are checked live against production."
    : "Component state below is read live from our production health check. Incident history and communication policy are maintained by hand and are informational.";

  return (
    <LegalDoc
      eyebrow="Trust"
      h1="System Status"
      updated="August 19, 2026"
      lede={lede}
      sections={[
        componentsSection,
        {
          id: "incidents",
          h2: "Incident History",
          body: [
            "Informational and maintained by hand: no incidents reported in the last 90 days.",
          ],
        },
        {
          id: "notifications",
          h2: "How We Communicate",
          body: [
            "During an incident we post here first and, for anything lasting more than 30 minutes, email affected account holders. Planned maintenance is announced at least 48 hours ahead and scheduled outside United States business hours where possible.",
            "To report an outage we have not caught, email support@realdesigns.ai. If you saw an error with a reference code beginning RD-, include it — it lets us trace exactly what happened.",
          ],
        },
      ]}
    />
  );
}
