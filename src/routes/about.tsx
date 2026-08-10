import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";
import { absoluteUrl } from "@/lib/site";

import "@/styles/rd-site.css";

const TITLE = "About REAL DESIGNS | From AI Rendering To Real Project Planning";
const DESCRIPTION =
  "Learn how REAL DESIGNS turns photos, sketches and floor plans into realistic redesigns, budget-guided scopes, shopping lists and contractor-ready project plans.";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/about") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/about") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About REAL DESIGNS",
          description: DESCRIPTION,
          url: absoluteUrl("/about"),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: absoluteUrl("/"),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "About",
              item: absoluteUrl("/about"),
            },
          ],
        }),
      },
    ],
  }),
});

function AboutPage() {
  return (
    <div className="rd-site rd-lp">
      <SiteHeader />

      <main>
        <section className="hero arch" id="top" style={{ paddingTop: 54 }}>
          <div className="wrap">
            <nav className="crumbs" aria-label="Breadcrumb">
              <a href="/">Home</a>
              <span aria-hidden="true">/</span>
              <span>About</span>
            </nav>

            <div className="hero-head">
              <p className="eyebrow">About REAL DESIGNS</p>
              <h1>
                Built For The Work
                <br />
                After The Rendering.
              </h1>
              <p className="lede">
                REAL DESIGNS helps turn a photo, sketch or floor plan into a
                realistic design, a planning range and a project handoff—while
                preserving the real space you started with.
              </p>
              <div className="badge-row">
                <a className="btn btn-primary" href="/#builder">
                  Start With Your Space
                </a>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <header className="sec-head">
              <p className="eyebrow">Why We Built It</p>
              <h2>A Design Tool Grounded In Real Projects.</h2>
              <p>
                Most AI design products stop at the image. REAL DESIGNS
                connects the image to the decisions that come next: what stays,
                what changes, what it may cost and what to hand to the people
                doing the work.
              </p>
            </header>

            <div className="hub-grid">
              <article className="hub-card">
                <p className="eyebrow">01</p>
                <h3>Preserve What Is Real</h3>
                <p>
                  Reality Lock keeps walls, windows, camera angle and selected
                  objects anchored across versions.
                </p>
              </article>

              <article className="hub-card">
                <p className="eyebrow">02</p>
                <h3>Design To A Number</h3>
                <p>
                  Choose a budget band or target before generating so the
                  concept matches the level of work you intend to fund.
                </p>
              </article>

              <article className="hub-card">
                <p className="eyebrow">03</p>
                <h3>Turn The Look Into A Plan</h3>
                <p>
                  Translate approved designs into planning ranges, shopping
                  lists and contractor-ready scope.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="alt">
          <div className="wrap">
            <header className="sec-head">
              <p className="eyebrow">One Connected Workspace</p>
              <h2>One Workflow Around The Property.</h2>
              <p>
                Keep the concept, the numbers and the decisions connected from
                the first idea through the project handoff.
              </p>
            </header>

            <div className="hub-grid">
              <article className="hub-card">
                <h3>For Owners &amp; Investors</h3>
                <p>
                  Visualize choices before spending and compare budget bands
                  against the same real space.
                </p>
              </article>

              <article className="hub-card">
                <h3>For Design &amp; Real Estate Teams</h3>
                <p>
                  Keep rooms, versions and approvals together while presenting
                  one consistent design direction.
                </p>
              </article>

              <article className="hub-card">
                <h3>For The People Building It</h3>
                <p>
                  Translate the approved direction into quantities, trades and
                  a contractor-ready handoff.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <header className="sec-head">
              <p className="eyebrow">Built For Real Markets</p>
              <h2>Designed For Global Use. Verified Locally.</h2>
              <p>
                REAL DESIGNS can help teams anywhere visualize and organize a
                project. Labor, materials, permitting and disclosure
                requirements vary by market, so planning ranges require local
                verification and are not construction bids.
              </p>
              <div className="badge-row">
                <a className="btn btn-primary" href="/#builder">
                  Start Free With Your Space
                </a>
              </div>
            </header>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
