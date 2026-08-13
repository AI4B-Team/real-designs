import { createFileRoute } from "@tanstack/react-router";

import { PrototypeSurface } from "@/components/PrototypeSurface";
import { html } from "@/content/rd-app-html";
import { initApp } from "@/content/rd-app-script";
import "@/styles/rd-app.css";
import "@/styles/rd-explore.css";
import "@/styles/rd-shop.css";
import "@/styles/rd-media.css";

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
      { property: "og:url", content: "/app" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/app" }],
  }),
  component: BackOfficePage,
});

function BackOfficePage() {
  return <PrototypeSurface className="rd-app" html={html} init={initApp} />;
}
