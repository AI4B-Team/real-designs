import { createFileRoute } from "@tanstack/react-router";

import { PrototypeSurface } from "@/components/PrototypeSurface";
import { html } from "@/content/rd-site-html";
import { initSite } from "@/content/rd-site-script";
import { FAQ } from "@/content/rd-faq";
import "@/styles/rd-site.css";
import { absoluteUrl } from "@/lib/site";

const title = "AI Home Design and Renovation Planning | REAL DESIGNS";
const description =
  "Turn one photo into a photoreal redesign of your real space, plus a planning budget range, shopping list and contractor-ready scope.";


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
      { property: "og:image", content: absoluteUrl("/og-cover.jpg") },
      { name: "twitter:image", content: absoluteUrl("/og-cover.jpg") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map(([question, answer]) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: { "@type": "Answer", text: answer },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "REAL DESIGNS",
          url: absoluteUrl("/"),
          applicationCategory: "DesignApplication",
          operatingSystem: "Web",
          description,
          offers: [
            { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
            { "@type": "Offer", name: "Starter", price: "7", priceCurrency: "USD" },
            { "@type": "Offer", name: "Pro", price: "10", priceCurrency: "USD" },
            { "@type": "Offer", name: "Studio", price: "13", priceCurrency: "USD" },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "REAL DESIGNS",
          url: absoluteUrl("/"),
          logo: absoluteUrl("/og-cover.jpg"),
        }),
      },
    ],
  }),

  component: SitePage,
});

function SitePage() {
  return <PrototypeSurface className="rd-site" html={html} init={initSite} />;
}
