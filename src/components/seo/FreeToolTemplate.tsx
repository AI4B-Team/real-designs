import type { ReactNode } from "react";

import { LABEL_BY_PATH } from "@/content/seo/nav";
import type { Faq, ProseSection } from "@/content/seo/types";
import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";

type Props = {
  eyebrow: string;
  h1: string;
  lede: string;
  intro: string[];
  tool: ReactNode;
  sections: ProseSection[];
  faqs: Faq[];
  related: string[];
  ctaTitle: string;
  ctaBody: string;
};

export function FreeToolTemplate({
  eyebrow,
  h1,
  lede,
  intro,
  tool,
  sections,
  faqs,
  related,
  ctaTitle,
  ctaBody,
}: Props) {
  return (
    <div className="rd-site rd-lp">
      <SiteHeader />

      <section className="hero arch" id="top" style={{ paddingTop: 54 }}>
        <div className="wrap">
          <div className="hero-head">
            <span className="eyebrow">{eyebrow}</span>
            <h1>{h1}</h1>
            <p className="lede">{lede}</p>
          </div>
        </div>
        <div className="wrap lp-hero">
          <div className="lp-intro">
            {intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <div className="badge-row" style={{ marginTop: 18 }}>
              <span className="pb ok">No Account</span>
              <span className="pb">No Credit Card</span>
              <span className="pb">Planning Range, Not A Bid</span>
            </div>
          </div>
          <div>{tool}</div>
        </div>
      </section>

      <section className="alt">
        <div className="wrap lp-prose">
          {sections.map((s) => (
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

      <section id="faq">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Questions</span>
            <h2>Answers Before You Start.</h2>
          </div>
          <div className="lp-faq">
            {faqs.map((f) => (
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

      <section className="alt">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Keep Reading</span>
            <h2>Related Pages.</h2>
          </div>
          <div className="lp-links">
            {related.map((s) => (
              <a className="card lp-link" href={s} key={s}>
                <b>{LABEL_BY_PATH[s] ?? s}</b>
                <span className="mono">{s}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="dark arch">
        <div className="wrap">
          <div className="sec-head">
            <h2>{ctaTitle}</h2>
            <p className="lede">{ctaBody}</p>
            <div style={{ marginTop: 24 }}>
              <a href="#builder" className="btn btn-primary btn-lg">
                Use The Tool
              </a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
