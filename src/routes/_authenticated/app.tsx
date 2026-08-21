import { createFileRoute } from "@tanstack/react-router";

import { absoluteUrl } from "@/lib/site";

import { AppShell } from "@/features/app-shell/AppShell";
import { LegacyOverlays, LegacyRuntime, LegacyViews } from "@/features/legacy/LegacyPrototypeView";
import "@/styles/rd-app.css";
import "@/styles/rd-canvas.css";
import "@/styles/rd-explore.css";
import "@/styles/rd-shop.css";
import "@/styles/rd-media.css";
import "@/styles/rd-media-lib.css";
import "@/styles/rd-reports.css";
import "@/styles/rd-lvideo.css";
import "@/styles/rd-reveal.css";
import "@/styles/rd-voice.css";
import "@/styles/rd-present.css";
import "@/styles/rd-staging.css";
import "@/styles/rd-photo-editor.css";

const title = "Back Office | REAL DESIGNS";
const description =
  "Manage properties, projects, renders, budgets and client approvals inside the REAL DESIGNS back office.";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/app") },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/app") }],
  }),
  component: BackOfficePage,
});

function BackOfficePage() {
  return (
    <div className="rd-app">
      <AppShell>
        <LegacyViews />
      </AppShell>
      <LegacyOverlays />
      <LegacyRuntime />
    </div>
  );
}
