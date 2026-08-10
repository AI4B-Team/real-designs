import { createFileRoute } from "@tanstack/react-router";

import { LegalDoc } from "@/components/seo/LegalDoc";
import { pageHead } from "@/lib/page-head";
import "@/styles/rd-site.css";

const TITLE = "System Status | REAL DESIGNS";
const DESC =
  "Current availability of REAL DESIGNS design generation, estimating, presentations and sign in, plus how we communicate incidents and maintenance.";

export const Route = createFileRoute("/status")({
  head: () => pageHead("/status", TITLE, DESC),
  component: StatusPage,
});

function StatusPage() {
  return (
    <LegalDoc
      eyebrow="Trust"
      h1="System Status"
      updated="August 10, 2026"
      lede="All systems operational. This page is updated during any incident affecting generation, estimating or sign in."
      sections={[
        {
          id: "components",
          h2: "Components",
          bullets: [
            "Design generation: Operational",
            "Scope and budget estimating: Operational",
            "3D plans and walkthroughs: Operational",
            "Presentations and client approval links: Operational",
            "Sign in and account: Operational",
          ],
        },
        {
          id: "incidents",
          h2: "Incident History",
          body: ["No incidents reported in the last 90 days."],
        },
        {
          id: "notifications",
          h2: "How We Communicate",
          body: [
            "During an incident we post here first and, for anything lasting more than 30 minutes, email affected account holders. Planned maintenance is announced at least 48 hours ahead and scheduled outside United States business hours where possible.",
            "To report an outage we have not caught, email support@realdesigns.ai.",
          ],
        },
      ]}
    />
  );
}
