import { createFileRoute, notFound } from "@tanstack/react-router";

import { LandingTemplate } from "@/components/seo/LandingTemplate";
import { PHOTOS } from "@/content/rd-photos";
import { getLandingPage } from "@/content/seo/registry";
import { getRequestOrigin } from "@/lib/origin.functions";
import { absoluteUrl } from "@/lib/site";
import "@/styles/rd-site.css";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const page = getLandingPage(params.slug);
    if (!page) throw notFound();
    const origin = await getRequestOrigin();
    return { page, origin };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Page Not Found | REAL DESIGNS" }, { name: "robots", content: "noindex" }],
      };
    }
    const { page, origin } = loaderData;
    const image = origin ? `${origin}${PHOTOS[page.afterPhoto]}` : undefined;

    const scripts: { type: string; children: string }[] = [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "REAL DESIGNS",
          applicationCategory: "DesignApplication",
          operatingSystem: "Web",
          description: page.metaDescription,
          url: origin ? `${origin}${page.slug}` : page.slug,
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            description: "Free plan with five credits a day.",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: page.faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ];

    if (page.howTo) {
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: page.howTo.name,
          step: page.howTo.steps.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.name,
            text: s.text,
          })),
        }),
      });
    }

    return {
      meta: [
        { title: page.metaTitle },
        { name: "description", content: page.metaDescription },
        { property: "og:title", content: page.metaTitle },
        { property: "og:description", content: page.metaDescription },
        { property: "og:type", content: "website" },
        { property: "og:url", content: absoluteUrl(page.slug) },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: absoluteUrl(page.slug) }],
      scripts,
    };
  },
  component: LandingRoute,
});

function LandingRoute() {
  const { page } = Route.useLoaderData();
  return <LandingTemplate page={page} />;
}
