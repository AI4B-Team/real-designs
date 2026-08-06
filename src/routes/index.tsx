import { createFileRoute } from "@tanstack/react-router";

import { PrototypeSurface } from "@/components/PrototypeSurface";
import { html } from "@/content/rd-site-html";
import { initSite } from "@/content/rd-site-script";
import "@/styles/rd-site.css";

const title = "AI Home Design From a Photo | REAL DESIGNS";
const description =
  "Upload a photo and redesign interiors, exteriors and landscapes with AI. Refine every detail, estimate costs and turn your favorite design into a real plan.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: SitePage,
});

function SitePage() {
  return <PrototypeSurface className="rd-site" html={html} init={initSite} />;
}
