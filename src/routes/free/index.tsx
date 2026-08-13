import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";
import { FREE_TOOL_LINKS } from "@/content/seo/nav";
import { absoluteUrl } from "@/lib/site";
import "@/styles/rd-site.css";

const TITLE = "Free Design And Renovation Tools | REAL DESIGNS";
const DESC =
  "Run a free AI redesign, virtual staging, rehab cost calculator or ARV calculator. No account, no card, planning ranges you can use today.";

export const Route = createFileRoute("/free/")({
  component: FreeToolsHub,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/free") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/free") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "REAL DESIGNS Free Tools",
          description: DESC,
          url: absoluteUrl("/free"),
          hasPart: FREE_TOOL_LINKS.map((l) => ({
            "@type": "WebPage",
            name: l.label,
            url: absoluteUrl(l.href),
          })),
        }),
      },
    ],
  }),
});

function FreeToolsHub() {
  return (
    <div className="rd-site rd-lp">
      <SiteHeader />

      <section className="hero arch" id="top" style={{ paddingTop: 54 }}>
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a> <span aria-hidden="true">/</span> <span>Free Tools</span>
          </nav>
          <div className="hero-head">
            <span className="eyebrow">No Account Needed</span>
            <h1>Free Design And Renovation Tools</h1>
            <p className="lede">
              Start with a photo or a number. Every tool here runs free, and each one hands off into
              the same workspace when you are ready to price the whole project.
            </p>
          </div>
        </div>
      </section>

      <section className="alt">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Pick A Starting Point</span>
            <h2>Open A Tool</h2>
            <p className="lede">Run the numbers or a first render without an account.</p>
          </div>
          <div className="hub-grid">
            {FREE_TOOL_LINKS.map((l) => (
              <a className="hub-card" href={l.href} key={l.href}>
                <h3>{l.label}</h3>
                <p>Free to run, no card required.</p>
                <span className="hub-go">Open Tool</span>
              </a>
            ))}
            <a className="hub-card" href="/resources">
              <h3>Resources Hub</h3>
              <p>Every design, cost and scope guide we publish.</p>
              <span className="hub-go">Browse Guides</span>
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
