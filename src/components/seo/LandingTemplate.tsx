import { PHOTOS } from "@/content/rd-photos";
import { CARD_BY_ID } from "@/content/seo/showcase-cards";
import { LABEL_BY_PATH } from "@/content/seo/nav";
import type { LandingPage } from "@/content/seo/types";
import { Builder } from "@/components/seo/Builder";
import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";
import { fmt } from "@/lib/planning-range";

const PLANS = [
  { name: "Free", price: "$0", note: "5 credits a day, typical budget range", cta: "Start Free" },
  { name: "Starter", price: "$7", note: "200 credits a month, clean HD", cta: "Choose Starter" },
  { name: "Pro", price: "$10", note: "2,000 credits a month, commercial license", cta: "Choose Pro", pop: true },
  { name: "Studio", price: "$13", note: "4,000 credits a month, unlimited seats", cta: "Choose Studio" },
];


export function LandingTemplate({ page }: { page: LandingPage }) {
  const before = PHOTOS[page.beforePhoto];
  const after = PHOTOS[page.afterPhoto];
  const scopeLow = page.scopeLines.reduce((s, l) => s + l.low, 0);
  const scopeHigh = page.scopeLines.reduce((s, l) => s + l.high, 0);
  const cards = page.showcase.map((id) => CARD_BY_ID.get(id)).filter(Boolean);

  return (
    <div className="rd-site rd-lp">
      <SiteHeader />

      {/* 1. HERO */}
      <section className="hero arch" id="top" style={{ paddingTop: 54 }}>
        <div className="wrap">
          <div className="hero-head">
            <span className="eyebrow">{page.eyebrow}</span>
            <h1>{page.h1}</h1>
            <p className="lede">{page.lede}</p>
          </div>
        </div>
        <div className="wrap lp-hero">
          <div className="lp-intro">
            {page.intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <div className="badge-row" style={{ marginTop: 18 }}>
              <span className="pb ok">Reality Lock</span>
              <span className="pb">Budget-First Generation</span>
              <span className="pb">Contractor-Ready Scope</span>
            </div>
          </div>
          <div>
            <Builder
              spaceType={page.spaceType}
              roomType={page.roomType}
              budgetBand={page.budgetBand}
              afterPhoto={after}
            />
          </div>
        </div>
      </section>

      {/* 2. BEFORE / AFTER */}
      <section className="alt">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Same Space, Priced</span>
            <h2>One Photo In. A Plan Out.</h2>
          </div>
          <div className="lp-ba">
            <figure>
              <img src={before} alt={page.beforeCaption} loading="lazy" />
              <figcaption>
                <b className="mono">Before</b> {page.beforeCaption}
              </figcaption>
            </figure>
            <figure>
              <img src={after} alt={page.afterCaption} loading="lazy" />
              <figcaption>
                <b className="mono">After</b> {page.afterCaption}
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">How It Works</span>
            <h2>Three Steps, One Running Total.</h2>
          </div>
          <div className="lp-steps">
            {page.steps.map((s, i) => (
              <div className="lp-step card" key={s.title}>
                <span className="mono lp-step-n">{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3b. HOW TO */}
      {page.howTo && (
        <section id="howto">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Step By Step</span>
              <h2>{page.howTo.name}</h2>
            </div>
            <ol className="lp-howto">
              {page.howTo.steps.map((s) => (
                <li key={s.name}>
                  <h3>{s.name}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}



      {/* 4. SHOWCASE */}
      <section className="alt">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">What You Get</span>
            <h2>The Tools This Page Uses.</h2>
          </div>
          <div className="lp-cards">
            {cards.map((c) => (
              <a className="card lp-card" href={c!.href} key={c!.id}>
                <div className="lp-card-media">
                  <img src={c!.photo} alt={c!.title} loading="lazy" />
                </div>
                <h3>{c!.title}</h3>
                <p>{c!.line}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 5. BUDGET AND SCOPE */}
      <section id="scope">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Budget And Scope</span>
            <h2>{page.scopeTitle}</h2>
            <p className="lede">{page.scopeIntro}</p>
          </div>
          <div className="lp-scope card">
            <div className="lp-scope-head">
              <div>
                <span className="mono">Estimated Planning Range</span>
                <b>
                  {fmt(scopeLow)} to {fmt(scopeHigh)}
                </b>
              </div>
              <div>
                <span className="mono">Pricing Confidence</span>
                <b className={page.confidence === "High" ? "conf-hi" : "conf-md"}>
                  {page.confidence}
                </b>
              </div>
            </div>
            <table className="lp-table">
              <thead>
                <tr>
                  <th>Line Item</th>
                  <th>Trade</th>
                  <th className="mono">Qty</th>
                  <th className="mono">Planning Range</th>
                </tr>
              </thead>
              <tbody>
                {page.scopeLines.map((l) => (
                  <tr key={l.item}>
                    <td>{l.item}</td>
                    <td>{l.trade}</td>
                    <td className="mono">{l.qty}</td>
                    <td className="mono">
                      {fmt(l.low)} to {fmt(l.high)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="lp-basis mono">{page.scopeBasis}</p>
          </div>
        </div>
      </section>

      {/* BODY COPY */}
      <section className="alt">
        <div className="wrap lp-prose">
          {page.sections.map((s) => (
            <article key={s.h2}>
              <h2>{s.h2}</h2>
              {s.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {s.bullets && (
                <ul>
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* 6. FAQ */}
      <section id="faq">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Questions</span>
            <h2>Answers Before You Start.</h2>
          </div>
          <div className="lp-faq">
            {page.faqs.map((f) => (
              <details key={f.q}>
                <summary>
                  <h3>{f.q}</h3>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 7. PRICING */}
      <section className="alt" id="pricing">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Pricing</span>
            <h2>Pick The Plan. Keep The Number.</h2>
            <p className="lede">
              Annual pricing shown. One credit balance across every tool, and we meter credits, not people.
            </p>

          </div>
          <div className="lp-plans">
            {PLANS.map((p) => (
              <div className={`card lp-plan${p.pop ? " pop" : ""}`} key={p.name}>
                {p.pop && <span className="lp-pop mono">Most Popular</span>}
                <h3>{p.name}</h3>
                <div className="lp-price">
                  <b>{p.price}</b>
                  <span>/mo</span>
                </div>
                <p>{p.note}</p>
                <a href="/#pricing" className={`btn ${p.pop ? "btn-primary" : "btn-ghost"} btn-block`}>
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. INTERNAL LINKS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Keep Reading</span>
            <h2>Related Pages.</h2>
          </div>
          <div className="lp-links">
            {page.relatedSlugs.map((s) => (
              <a className="card lp-link" href={s} key={s}>
                <b>{LABEL_BY_PATH[s] ?? s}</b>
                <span className="mono">{s}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 9. FINAL CTA */}
      <section className="dark arch">
        <div className="wrap">
          <div className="sec-head">
            <h2>{page.ctaTitle}</h2>
            <p className="lede">{page.ctaBody}</p>
            <div style={{ marginTop: 24 }}>
              <a href="#builder" className="btn btn-primary btn-lg">
                {page.ctaLabel}
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
