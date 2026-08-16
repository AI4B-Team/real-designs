import { createFileRoute } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { useState } from "react";

import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";
import { PRICING_FAQ as FAQ } from "@/content/pricing-faq";
import { absoluteUrl } from "@/lib/site";
import "@/styles/rd-site.css";

const TITLE = "Pricing — Plans For Every Project | REAL DESIGNS";
const DESC =
  "Start free. Upgrade for more projects, professional planning tools or team collaboration. Compare Free, Starter, Pro and Studio plans for REAL DESIGNS.";

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
  f: string[];
};

const PLANS: Plan[] = [
  {
    n: "Free",
    mo: 0,
    yr: 0,
    who: "Homeowners Trying Ideas",
    cta: "Start Free",
    f: [
      "5 Designs A Day",
      "Interiors, Exteriors & Landscapes",
      "Full Style Library & Reality Lock",
      "Virtual Staging & Declutter",
      "Watermarked Standard Resolution",
    ],
  },
  {
    n: "Starter",
    mo: 15,
    yr: 7,
    who: "One Property At A Time",
    cta: "Choose Starter",
    f: [
      "200 Credits A Month",
      "Clean HD, No Watermark",
      "Scope & Budget From Your Photo",
      "Shopping List With Product Links",
      "Before & After Presentation",
      "Personal Use License",
    ],
  },
  {
    n: "Pro",
    mo: 25,
    yr: 10,
    who: "Multiple Active Projects",
    cta: "Choose Pro",
    pop: true,
    f: [
      "2,000 Credits A Month",
      "Everything In Starter",
      "Commercial License",
      "Contractor Brief PDF & ARV Range",
      "Batch Listing Staging",
      "5 Team Seats",
    ],
  },
  {
    n: "Studio",
    mo: 35,
    yr: 13,
    who: "Teams & Client Work",
    cta: "Choose Studio",
    f: [
      "4,000 Credits A Month",
      "Everything In Pro",
      "Video Walkthroughs",
      "2D To 3D Floor Plans",
      "Client Approval Portal",
      "Unlimited Team Seats",
    ],
  },
];

const CHOOSER = [
  {
    plan: "Starter",
    a: "One Property At A Time",
    b: "Personal Redesigns",
    c: "Best For Homeowners",
  },
  {
    plan: "Pro",
    a: "Multiple Active Projects",
    b: "Budgets, Scopes & Commercial Use",
    c: "Best For Investors & Contractors",
  },
  {
    plan: "Studio",
    a: "Teams & Client Work",
    b: "Collaboration & Advanced Outputs",
    c: "Best For Design Teams",
  },
];


function PricingPage() {
  const [bill, setBill] = useState<"mo" | "yr">("yr");

  return (
    <div className="rd-site rd-lp rd-pricing">
      <SiteHeader />

      <section className="alt">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">Pricing</span>
            <h1>Simple Plans For Every Kind Of Project.</h1>
            <p className="lede lede-wide">
              Start free. Upgrade for more projects, professional planning tools or team
              collaboration.
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

          <div className="plans plans-tidy">
            {PLANS.map((p) => (
              <div className={`plan${p.pop ? " pop" : ""}`} key={p.n}>
                <h3>{p.n}</h3>
                <div className="who">{p.who}</div>
                <div className="pr">
                  <b>${p[bill]}</b>
                  <span>/month</span>
                </div>
                <div className="bill-exp">
                  {p.mo === 0
                    ? "Free forever, no card required"
                    : bill === "yr"
                      ? `Billed $${p.yr * 12} annually`
                      : `Billed $${p.mo} monthly`}
                </div>
                <a
                  href="/auth"
                  className={`btn ${p.pop ? "btn-primary" : "btn-ghost"} btn-block`}
                >
                  {p.cta}
                </a>
                <ul>
                  {p.f.map((f) => (
                    <li key={f}>
                      <Check size={16} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="price-more">
            <a href="/pricing/compare">
              Compare Every Feature <ArrowRight size={15} />
            </a>
          </p>

          <p className="price-trust">
            No credit card to start &middot; Cancel anytime &middot; 30 day money back on paid plans
          </p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">Choose Your Plan</span>
            <h2>Which Plan Is For Me?</h2>
          </div>

          <div className="chooser">
            {CHOOSER.map((c) => (
              <div className="ch" key={c.plan}>
                <b>{c.plan}</b>
                <span>{c.a}</span>
                <span>{c.b}</span>
                <em>{c.c}</em>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="alt">
        <div className="wrap">
          <div className="credit-note">
            <h3>One Balance. Every Tool.</h3>
            <p>
              Use credits for designs, budgets, floor plans and walkthroughs. Most redesigns use one
              credit. Your dashboard always shows the cost before you generate.
            </p>
            <a href="/pricing/credits" className="lnk">
              See Credit Usage <ArrowRight size={15} />
            </a>
          </div>

          <div className="oneoff">
            <div>
              <h4>Only Need One Project?</h4>
              <p>
                Purchase a room, listing, whole home or renovation package without subscribing.
              </p>
            </div>
            <a href="/pricing/credits#packs" className="btn btn-ghost">
              View Project Packs
            </a>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">Questions</span>
            <h2>Answers Before You Choose.</h2>
          </div>

          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="alt">
        <div className="wrap">
          <div className="final-cta">
            <h2>Start With Five Free Designs Today.</h2>
            <p>No card, no commitment. Upgrade the moment a project gets real.</p>
            <div className="cta-row">
              <a href="/auth" className="btn btn-primary">
                Start Free
              </a>
              <a href="/founders" className="btn btn-ghost">
                See Founding Member Pricing
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
