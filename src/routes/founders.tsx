import { createFileRoute } from "@tanstack/react-router";
import { Check, Gift, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";
import { absoluteUrl } from "@/lib/site";
import "@/styles/rd-site.css";

const TITLE = "Founding Member Pricing — First 500 Accounts | REAL DESIGNS";
const DESC =
  "The first 500 REAL DESIGNS accounts lock launch pricing for life and get the Renovation Planning Pack included. See the offer, the terms and the live remaining count.";

export const Route = createFileRoute("/founders")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absoluteUrl("/founders") },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: absoluteUrl("/og-cover.jpg") },
      { name: "twitter:image", content: absoluteUrl("/og-cover.jpg") },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/founders") }],
  }),
  component: FoundersPage,
});

type Count = { claimed: number; limit: number; remaining: number; open: boolean };

const FAQ: [string, string][] = [
  [
    "What does founding pricing lock in?",
    "The launch rate on the plan you choose, for as long as your subscription stays active. When we raise prices later, your rate stays where it started.",
  ],
  [
    "How is the remaining count calculated?",
    "It is read live from claimed founding accounts. There is no countdown timer and no reset.",
  ],
  [
    "What is the fast action bonus?",
    "Every founding account includes the Renovation Planning Pack, a $49 value, added to the workspace on signup.",
  ],
  [
    "What happens when the 500 are gone?",
    "The offer closes and standard pricing applies. Existing founding accounts are unaffected.",
  ],
  [
    "Is there a guarantee?",
    "Yes. Every paid plan includes a 30 day money back guarantee and cancels from your dashboard in two clicks.",
  ],
];

const PLANS = [
  { n: "Starter", p: "$7/mo", sub: "Billed yearly · $15/mo monthly", who: "One property. Personal projects." },
  { n: "Pro", p: "$10/mo", sub: "Billed yearly · $25/mo monthly", who: "Investors, agents and contractors.", pop: true },
  { n: "Studio", p: "$13/mo", sub: "Billed yearly · $35/mo monthly", who: "Design teams and brokerage offices." },
];

function FoundersPage() {
  const [count, setCount] = useState<Count | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/public/founding")
      .then((r) => r.json())
      .then((d) => {
        if (alive && typeof d?.remaining === "number") setCount(d as Count);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="rd-site rd-lp">
      <SiteHeader />

      <section className="alt">
        <div className="wrap">
          <div className="found" style={{ marginBottom: 28 }}>
            <div className="found-main">
              <span className="found-eyebrow mono">Founding Member Pricing</span>
              <h1 style={{ fontSize: "1.9rem", letterSpacing: "-.02em" }}>
                First 500 Accounts Lock This Rate For Life.
              </h1>
              <p>
                When these are gone the price goes up and stays up. No resets, no second chances, no
                fake timers.
              </p>
              <p className="found-bonus">
                <Gift size={15} />
                <b>Fast Action Bonus:</b> Renovation Planning Pack, a $49 value, included with every
                founding account.
              </p>
              <a href="/auth" className="btn btn-primary" style={{ marginTop: 14 }}>
                Claim Founding Pricing
              </a>
            </div>
            {count ? (
              <div className="found-count">
                <span className="mono">Seats Remaining</span>
                <b className="mono">{count.remaining}</b>
                <div className="found-bar">
                  <i style={{ width: `${Math.round((count.claimed / count.limit) * 100)}%` }} />
                </div>
                <small className="mono">
                  {count.open
                    ? `${count.claimed} of ${count.limit} claimed`
                    : "Founding pricing is closed"}
                </small>
              </div>
            ) : null}
          </div>

          <div className="plans plans-3">
            {PLANS.map((p) => (
              <div className={`plan${p.pop ? " pop" : ""}`} key={p.n}>
                <h3>{p.n}</h3>
                <div className="pr">
                  <b>{p.p}</b>
                </div>
                <div className="who">{p.sub}</div>
                <p style={{ fontSize: ".84rem" }}>{p.who}</p>
                <a href="/auth" className={`btn ${p.pop ? "btn-primary" : "btn-ghost"} btn-block`}>
                  Choose {p.n}
                </a>
                <p className="plan-note">30 day money back · Cancel anytime</p>
                <ul>
                  <li>
                    <Check size={15} />
                    <span>Rate locked while your subscription stays active</span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>Renovation Planning Pack included</span>
                  </li>
                  <li>
                    <Check size={15} />
                    <span>Founding member support queue</span>
                  </li>
                </ul>
              </div>
            ))}
          </div>

          <p className="price-trust mono">
            <ShieldCheck size={13} style={{ verticalAlign: "-2px" }} /> 30 day money back guarantee
            &middot; Cancel in two clicks &middot; Your images stay yours
          </p>
          <p className="price-more">
            <a href="/pricing">See Full Pricing And Credit Details</a>
          </p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow">Offer Questions</span>
            <h2>Founding Member FAQ.</h2>
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
            <a href="/auth">Claim Founding Pricing</a>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
