import { createFileRoute } from "@tanstack/react-router";

import { PrototypeSurface } from "@/components/PrototypeSurface";
import { html } from "@/content/rd-site-html";
import { initSite } from "@/content/rd-site-script";
import "@/styles/rd-site.css";
import { absoluteUrl } from "@/lib/site";

const title = "AI Home Design and Renovation Planning | REAL DESIGNS";
const description =
  "Other tools help you picture it. REAL DESIGNS plans it: budget-guided AI redesign on your real walls, a line-item scope, a shopping list and a contractor-ready brief.";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
  }),
  component: SitePage,
});

function SitePage() {
  return <PrototypeSurface className="rd-site" html={html} init={initSite} />;
}
