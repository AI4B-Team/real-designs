import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";
import { FREE_TOOL_LINKS } from "@/content/seo/nav";
import { LANDING_PAGES } from "@/content/seo/registry";
import type { LandingPage } from "@/content/seo/types";
import { absoluteUrl } from "@/lib/site";
import "@/styles/rd-site.css";

const TITLE = "Resources Hub — Design, Cost And Scope Guides | REAL DESIGNS";
const DESC =
  "Every REAL DESIGNS guide in one place: AI design pages, renovation cost breakdowns, contractor scope references and free planning tools.";

const GROUPS: { heading: string; blurb: string; priority: number; match: (p: LandingPage) => boolean }[] = [
  {
    heading: "Design Guides",
    blurb: "Generate a designed space from a real photo, then price what it takes to build it.",
    match: (p) => /design|staging|render|floor-plan|declutter|curb-appeal/.test(p.slug),
    priority: 4,
  },
  {
    heading: "Cost And Scope Guides",
    blurb: "Planning ranges, line item scopes and the decisions that actually move the number.",
    match: (p) => /cost|calculator|estimator|scope|grade/.test(p.slug),
    priority: 3,
  },
  {
    heading: "Rules And Compliance",
    blurb: "Disclosure and photo rules you need to follow before a staged image goes live.",
    match: (p) => /rules|disclosure|mls/.test(p.slug),
    priority: 2,
  },
  {
    heading: "By Role",
    blurb: "How flippers, contractors, agents, managers, designers and landlords use the workflow.",
    match: (p) => p.slug.startsWith("/for-") || p.slug.includes("house-flippers"),
    priority: 1,
  },
];

function grouped() {
  const used = new Set<string>();
  const byHeading = new Map<string, LandingPage[]>();
  // Assign each page to its most specific group first, then render in display order.
  for (const g of [...GROUPS].sort((a, b) => a.priority - b.priority)) {
    const pages = LANDING_PAGES.filter((p) => !used.has(p.slug) && g.match(p));
    pages.forEach((p) => used.add(p.slug));
    byHeading.set(g.heading, pages);
  }
  const out = GROUPS.map((g) => ({ ...g, pages: byHeading.get(g.heading) ?? [] })).filter(
    (g) => g.pages.length > 0,
  );
  const rest = LANDING_PAGES.filter((p) => !used.has(p.slug));
  if (rest.length) {
    out.push({
      heading: "More Guides",
      blurb: "Everything else worth reading before you commit a budget.",
      priority: 99,
      match: () => true,
      pages: rest,
    });
  }
  return out;
}

export const Route = createFileRoute("/resources")({
  component: ResourcesPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/resources") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/resources") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "REAL DESIGNS Resources Hub",
          description: DESC,
          url: absoluteUrl("/resources"),
          hasPart: LANDING_PAGES.map((p) => ({
            "@type": "WebPage",
            name: p.metaTitle,
            url: absoluteUrl(p.slug),
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Resources", item: absoluteUrl("/resources") },
          ],
        }),
      },
    ],
  }),
});

function ResourcesPage() {
  const groups = grouped();

  return (
    <div className="rd-site rd-lp">
      <SiteHeader />

      <section className="hero arch" id="top" style={{ paddingTop: 54 }}>
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a> <span aria-hidden="true">/</span> <span>Resources</span>
          </nav>
          <div className="hero-head">
            <span className="eyebrow">Resources Hub</span>
            <h1>Design, Cost And Scope Guides</h1>
            <p className="lede">
              Every guide we publish, grouped by what you are trying to decide. Each one pairs a real
              before and after with a line item planning range, so the design and the budget come
              from the same page.
            </p>
          </div>
          <div className="badge-row" style={{ marginTop: 18 }}>
            <span className="pb ok">{LANDING_PAGES.length} Guides</span>
            <span className="pb">{FREE_TOOL_LINKS.length} Free Tools</span>
            <span className="pb">Planning Ranges, Not Bids</span>
          </div>
        </div>
      </section>

      <section className="alt">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">No Account Needed</span>
            <h2>Free Tools</h2>
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
          </div>
        </div>
      </section>

      {groups.map((g, i) => (
        <section key={g.heading} className={i % 2 === 0 ? "" : "alt"}>
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Guides</span>
              <h2>{g.heading}</h2>
              <p className="lede">{g.blurb}</p>
            </div>
            <div className="hub-grid">
              {g.pages.map((p) => (
                <a className="hub-card" href={p.slug} key={p.slug}>
                  <h3>{p.h1}</h3>
                  <p>{p.intent}</p>
                  <span className="hub-go">Read Guide</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="alt">
        <div className="wrap">
          <div className="sec-head">
            <h2>Start With Your Own Photo</h2>
            <p className="lede">
            Upload a room, set a budget band and get a design plus a contractor-ready scope in the
            same session.
            </p>
            <a className="btn btn-primary" href="/#builder">
              Upload Your Space
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
