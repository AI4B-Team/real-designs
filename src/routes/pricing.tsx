import { createFileRoute } from "@tanstack/react-router";
import { Check, X, ArrowRight } from "lucide-react";
import { useState } from "react";

import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";
import { absoluteUrl } from "@/lib/site";
import "@/styles/rd-site.css";

const TITLE = "Pricing — Plans, Credits And Project Packs | REAL DESIGNS";
const DESC =
  "Compare REAL DESIGNS plans: free daily designs, Starter, Pro and Studio. See what each plan produces, credit allowances, top ups and one time project packs.";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/pricing") },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: absoluteUrl("/og-cover.jpg") },
      { name: "twitter:image", content: absoluteUrl("/og-cover.jpg") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/pricing") }],
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
          "@type": "Product",
          name: "REAL DESIGNS",
          description: DESC,
          url: absoluteUrl("/pricing"),
          brand: { "@type": "Brand", name: "REAL DESIGNS" },
          offers: PLANS.map((p) => ({
            "@type": "Offer",
            name: p.n,
            price: String(p.yr),
            priceCurrency: "USD",
            url: absoluteUrl("/pricing"),
            availability: "https://schema.org/InStock",
          })),
        }),
      },
    ],
  }),
  component: PricingPage,
});

type Plan = {
  n: string;
  mo: number;
  yr: number;
  who: string;
  cta: string;
  pop?: boolean;
  note: string;
  f: string[];
  x?: string[];
};

const PLANS: Plan[] = [
  {
    n: "Free",
    mo: 0,
    yr: 0,
    who: "Anyone. No card to start.",
    cta: "Start Free",
    note: "No card to start · Cancel anytime",
    f: [
      "5 credits a day",
      "Interiors, exteriors and landscapes",
      "Full style library and Reality Lock",
      "Virtual staging, declutter, material swap",
      "Typical budget range by room type",
      "Watermarked, standard resolution",
    ],
    x: ["Clean HD download", "Scope and budget from your photo", "Commercial license"],
  },
  {
    n: "Starter",
    mo: 15,
    yr: 7,
    who: "One property. Personal projects.",
    cta: "Choose Starter",
    note: "30 day money back · Cancel anytime",
    f: [
      "200 credits a month",
      "Clean HD, no watermark",
      "Personal use license",
      "Scope and budget from your photo",
      "Design DNA on one property",
      "Shopping list with live pricing",
      "Before and after presentation",
    ],
    x: ["Commercial license", "ARV impact range", "Batch listing staging"],
  },
  {
    n: "Pro",
    mo: 25,
    yr: 10,
    who: "Investors, flippers, contractors and agents.",
    cta: "Choose Pro",
    pop: true,
    note: "30 day money back · Cancel anytime",
    f: [
      "2,000 credits a month",
      "Everything in Starter",
      "Commercial license",
      "Contractor brief PDF",
      "ARV impact range",
      "Batch listing staging with MLS disclosure",
      "Design DNA across unlimited properties",
      "5 team seats",
    ],
    x: ["Video walkthroughs and 3D plans", "Client approval portal"],
  },
  {
    n: "Studio",
    mo: 35,
    yr: 13,
    who: "Design teams and brokerage offices.",
    cta: "Choose Studio",
    note: "30 day money back · Cancel anytime",
    f: [
      "4,000 credits a month",
      "Everything in Pro",
      "Video walkthroughs",
      "2D to 3D floor plans",
      "Client approval portal",
      "Brand presets and white label decks",
      "Priority render queue",
      "Unlimited team seats",
    ],
  },
];

const CAPACITY = [
  {
    plan: "Starter · 200 credits",
    lines: ["About 200 standard redesigns", "Or about 66 scope and budget reports", "Or a mix of both"],
  },
  {
    plan: "Pro · 2,000 credits",
    lines: [
      "About 2,000 standard redesigns",
      "Or about 660 scope and budget reports",
      "Enough for roughly 20 full property packages",
    ],
  },
  {
    plan: "Studio · 4,000 credits",
    lines: [
      "About 4,000 standard redesigns",
      "Or about 100 video walkthroughs",
      "Or about 660 furnished 3D floor plans",
    ],
  },
];

const FAQ: [string, string][] = [
  [
    "What is a credit?",
    "A credit is the unit we bill generation with. One design costs one credit, a scope and budget costs three, a furnished 3D floor plan costs six and a video walkthrough costs forty. The cost is shown before you spend it.",
  ],
  [
    "Do credits expire?",
    "Plan credits reset each billing period. Top up credits never expire while your subscription is active.",
  ],
  [
    "Can I use the images commercially?",
    "Yes on Pro and Studio. Starter is a personal use license. Free downloads are watermarked and not licensed for marketing use.",
  ],
  [
    "How do team seats work?",
    "Pro includes five seats sharing one credit balance. Studio includes unlimited seats with roles and client approval links.",
  ],
  [
    "Can I cancel anytime?",
    "Yes, in two clicks from your dashboard. You keep access until the end of the paid period and everything you already generated stays yours.",
  ],
  [
    "What is the refund policy?",
    "Paid plans include a 30 day money back guarantee. See the refund policy page for the full terms.",
  ],
];

function PricingPage() {
  const [bill, setBill] = useState<"mo" | "yr">("yr");

  return (
    <div className="rd-site rd-lp">
      <SiteHeader />

      <section className="alt">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">Pricing</span>
            <h1>Plans For Every Kind Of Project.</h1>
            <p className="lede lede-wide">
              Start free with five designs a day. Upgrade when you need professional downloads,
              budgets, scopes or a team. Every plan uses one credit balance, so there is nothing
              else to keep track of.
            </p>
          </div>

          <div className="bill">
            <div className="seg">
              <button className={bill === "mo" ? "on" : ""} onClick={() => setBill("mo")}>
                Monthly
              </button>
              <button className={bill === "yr" ? "on" : ""} onClick={() => setBill("yr")}>
                Annual
              </button>
            </div>
            <span className="save">Save With Yearly</span>
          </div>

          <div className="plans">
            {PLANS.map((p) => (
              <div className={`plan${p.pop ? " pop" : ""}`} key={p.n}>
                <h3>{p.n}</h3>
                <div className="pr">
                  <b>${p[bill]}</b>
                  <span>/mo</span>
                </div>
                <div className="who">
                  {p.mo === 0
                    ? "Free forever"
                    : bill === "yr"
                      ? `Billed yearly · $${p.mo}/mo monthly`
                      : "Billed monthly"}
                </div>
                <p style={{ fontSize: ".84rem" }}>{p.who}</p>
                <a
                  href="/auth"
                  className={`btn ${p.pop ? "btn-primary" : "btn-ghost"} btn-block`}
                >
                  {p.cta}
                </a>
                <p className="plan-note">{p.note}</p>
                <ul>
                  {p.f.map((f) => (
                    <li key={f}>
                      <Check size={15} />
                      <span>{f}</span>
                    </li>
                  ))}
                  {(p.x ?? []).map((f) => (
                    <li className="no" key={f}>
                      <X size={15} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="price-trust mono">
            No credit card to start &middot; Cancel anytime &middot; Commercial use on Pro and
            Studio
          </p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">What You Can Actually Make</span>
            <h2>How Much Work Fits In A Plan.</h2>
            <p className="lede lede-wide">
              Credits are just the meter. Here is the practical output each plan covers in a normal
              month.
            </p>
          </div>

          <div className="pack-row">
            {CAPACITY.map((c) => (
              <div className="pack" key={c.plan}>
                <b>{c.plan}</b>
                <small>
                  {c.lines.map((l) => (
                    <span key={l} style={{ display: "block" }}>
                      {l}
                    </span>
                  ))}
                </small>
              </div>
            ))}
          </div>

          <div className="credtab" style={{ marginTop: 26 }}>
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>See Exact Credit Usage</summary>
              <table className="cred-t" style={{ marginTop: 14 }}>
                <tbody>
                  <tr>
                    <td>
                      Design, restyle, virtual stage, declutter, material swap, sky swap, style
                      transfer
                    </td>
                    <td className="mono">1 credit</td>
                  </tr>
                  <tr>
                    <td>Scope and budget from your photo</td>
                    <td className="mono">3 credits</td>
                  </tr>
                  <tr>
                    <td>2D to 3D floor plan</td>
                    <td className="mono">6 credits</td>
                  </tr>
                  <tr>
                    <td>Video walkthrough</td>
                    <td className="mono">40 credits</td>
                  </tr>
                </tbody>
              </table>
              <p className="cred-note mono">
                Credits reset monthly and never expire while your subscription is active.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className="alt">
        <div className="wrap">
          <div className="topup">
            <h4>Need More This Month?</h4>
            <p>Top up any paid plan. Credits never expire while your subscription is active.</p>
            <div className="topup-row">
              <div className="tu">
                <b className="mono">250 Credits</b>
                <span className="mono">$5</span>
                <small className="mono">$0.020 Per Credit</small>
              </div>
              <div className="tu">
                <b className="mono">750 Credits</b>
                <span className="mono">$12</span>
                <small className="mono">$0.016 Per Credit</small>
              </div>
              <div className="tu">
                <b className="mono">2,000 Credits</b>
                <span className="mono">$25</span>
                <small className="mono">$0.013 Per Credit</small>
              </div>
            </div>
            <p className="tu-note mono">
              Top ups cost more per credit than the next plan up. If you are buying them often,
              upgrade instead.
            </p>
          </div>

          <div className="packs" style={{ marginTop: 26 }}>
            <h4>Not Ready For A Subscription?</h4>
            <p>
              One project does not need a monthly bill following you around. Buy the project, keep
              everything you make, walk away.
            </p>
            <div className="pack-row">
              <div className="pack">
                <b>Single Room Pack</b>
                <span>$12</span>
                <small>One room, unlimited versions, HD, 30 days</small>
              </div>
              <div className="pack">
                <b>Listing Staging Pack</b>
                <span>$29</span>
                <small>One property, all photos, disclosure labeling</small>
              </div>
              <div className="pack">
                <b>Whole Home Pack</b>
                <span>$39</span>
                <small>Every room, Design DNA, 60 days</small>
              </div>
              <div className="pack">
                <b>Renovation Planning Pack</b>
                <span>$49</span>
                <small>Whole home plus scope, budget and contractor brief</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">Details</span>
            <h2>Licensing, Seats And Cancellation.</h2>
          </div>

          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>

          <p className="price-more" style={{ marginTop: 24 }}>
            <a href="/founders">
              See Founding Member Pricing <ArrowRight size={15} />
            </a>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
