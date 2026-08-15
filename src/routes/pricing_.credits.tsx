import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";
import { absoluteUrl } from "@/lib/site";
import "@/styles/rd-site.css";

const TITLE = "Credits, Top Ups & Project Packs | REAL DESIGNS";
const DESC =
  "Exactly what each action costs in credits, how resets work, top up pricing and one time project packs for REAL DESIGNS.";

export const Route = createFileRoute("/pricing_/credits")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/pricing/credits") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/pricing/credits") }],
  }),
  component: CreditsPage,
});

const COSTS: [string, string][] = [
  ["Design, restyle, virtual stage, declutter, material swap, sky swap, style transfer", "1 credit"],
  ["Scope and budget from your photo", "3 credits"],
  ["2D to 3D floor plan", "6 credits"],
  ["Video walkthrough", "40 credits"],
];

const TOPUPS: [string, string, string][] = [
  ["250 Credits", "$5", "$0.020 per credit"],
  ["750 Credits", "$12", "$0.016 per credit"],
  ["2,000 Credits", "$25", "$0.013 per credit"],
];

const PACKS: [string, string, string][] = [
  ["Single Room Pack", "$12", "One room, unlimited versions, HD, 30 days"],
  ["Listing Staging Pack", "$29", "One property, all photos, disclosure labeling"],
  ["Whole Home Pack", "$39", "Every room, Design DNA, 60 days"],
  ["Renovation Planning Pack", "$49", "Whole home plus scope, budget and contractor brief"],
];

function CreditsPage() {
  return (
    <div className="rd-site rd-lp rd-pricing">
      <SiteHeader />

      <section className="alt">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">Credits</span>
            <h1>What Everything Costs.</h1>
            <p className="lede lede-wide">
              Credits are the usage meter behind every plan. One balance covers designs, budgets,
              floor plans and walkthroughs.
            </p>
          </div>

          <div className="credtab">
            <table className="cred-t">
              <tbody>
                {COSTS.map(([a, b]) => (
                  <tr key={a}>
                    <td>{a}</td>
                    <td className="mono">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="cred-note">
              Plan credits reset on your billing date. Purchased credits stay in your balance while
              your subscription is active. The cost of any action is shown in your dashboard before
              you generate.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head center">
            <h2>Top Ups</h2>
            <p className="lede lede-wide">
              Available on any paid plan from your billing settings.
            </p>
          </div>
          <div className="pack-row">
            {TOPUPS.map(([n, p, s]) => (
              <div className="pack" key={n}>
                <b>{n}</b>
                <span>{p}</span>
                <small>{s}</small>
              </div>
            ))}
          </div>
          <p className="cred-note center">
            Top ups cost more per credit than the next plan up. If you buy them often, upgrade
            instead.
          </p>
        </div>
      </section>

      <section className="alt" id="packs">
        <div className="wrap">
          <div className="sec-head center">
            <h2>One Time Project Packs</h2>
            <p className="lede lede-wide">
              One project does not need a monthly bill following you around. Buy the project, keep
              everything you make, walk away.
            </p>
          </div>
          <div className="pack-row">
            {PACKS.map(([n, p, s]) => (
              <div className="pack" key={n}>
                <b>{n}</b>
                <span>{p}</span>
                <small>{s}</small>
              </div>
            ))}
          </div>
          <p className="price-more">
            <a href="/pricing">
              <ArrowLeft size={15} /> Back To Plans
            </a>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
