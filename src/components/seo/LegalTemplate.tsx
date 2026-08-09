import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";

export type LegalSection = { h2: string; body: string[]; bullets?: string[] };

type Props = {
  eyebrow: string;
  h1: string;
  lede: string;
  updated: string;
  sections: LegalSection[];
};

export function LegalTemplate({ eyebrow, h1, lede, updated, sections }: Props) {
  return (
    <div className="rd-site rd-lp">
      <SiteHeader />

      <section className="hero arch" id="top" style={{ paddingTop: 54 }}>
        <div className="wrap">
          <div className="hero-head">
            <span className="eyebrow">{eyebrow}</span>
            <h1>{h1}</h1>
            <p className="lede">{lede}</p>
            <p className="mono" style={{ fontSize: ".74rem", marginTop: 10 }}>
              Last Updated {updated}
            </p>
          </div>
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

      <SiteFooter />
    </div>
  );
}
