import { AlertTriangle } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/seo/SiteChrome";
import "@/styles/rd-legal.css";

export type LegalDocSection = {
  /** Anchor id, e.g. "planning-estimates" */
  id: string;
  h2: string;
  /** Marks the section for attorney review. */
  counsel?: boolean;
  body?: string[];
  bullets?: string[];
  /** Rendered after the bullets. */
  after?: string[];
};

type Props = {
  eyebrow?: string;
  h1: string;
  updated: string;
  lede?: string;
  /** Visible draft banner text for pages awaiting counsel review. */
  draftNotice?: string;
  sections: LegalDocSection[];
  /** Optional block rendered under the last section. */
  footNote?: string;
};

export function LegalDoc({
  eyebrow = "Legal",
  h1,
  updated,
  lede,
  draftNotice,
  sections,
  footNote,
}: Props) {
  return (
    <div className="rd-site rd-legal">
      <SiteHeader />

      <main className="rd-legal-main">
        <header className="rd-legal-head">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{h1}</h1>
          {lede && <p className="rd-legal-lede">{lede}</p>}
          <p className="rd-legal-updated mono">Last Updated {updated}</p>
        </header>

        {draftNotice && (
          <div className="rd-legal-draft" role="note">
            <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
            <p>{draftNotice}</p>
          </div>
        )}

        <div className="rd-legal-body">
          <nav className="rd-legal-toc" aria-label="On This Page">
            <h2>On This Page</h2>
            <ol>
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>
                    <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                    {s.h2}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="rd-legal-prose">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id}>
                <h2>
                  <span className="mono rd-legal-num">{i + 1}.</span>
                  <a href={`#${s.id}`} className="rd-legal-anchor">
                    {s.h2}
                  </a>
                  {s.counsel && <span className="rd-legal-tag">Counsel Review</span>}
                </h2>
                {s.body?.map((p, j) => <p key={j}>{p}</p>)}
                {s.bullets && (
                  <ul>
                    {s.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                {s.after?.map((p, j) => <p key={`a${j}`}>{p}</p>)}
              </section>
            ))}
            {footNote && <p className="rd-legal-foot">{footNote}</p>}
          </article>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
