import { Globe } from "lucide-react";

import { FOOTER_COLUMNS, LEGAL_LINKS } from "@/content/seo/nav";
import "@/styles/rd-footer.css";

export function GlobalFooter() {
  return (
    <footer className="rd-foot">
      <a href="/" className="rd-foot-badge" aria-label="REAL DESIGNS Home">
        <span className="rd-foot-mark">
          <i>
            <b>REAL</b>
            <em>Designs</em>
          </i>
        </span>
      </a>
      <div className="rd-foot-wrap">
        <div className="rd-foot-grid">




          {FOOTER_COLUMNS.map((col) => (
            <details className="rd-foot-col" key={col.heading} open>
              <summary>
                <h4>{col.heading}</h4>
              </summary>
              <ul>
                {col.links
                  .filter((l) => l.href)
                  .map((l) => (
                    <li key={`${col.heading}-${l.label}`}>
                      <a href={l.href ?? undefined}>{l.label}</a>
                    </li>
                  ))}
              </ul>
            </details>
          ))}
        </div>




        <div className="rd-foot-legal">
          <span className="rd-foot-copy">&copy; 2026 REAL DESIGNS. All Rights Reserved.</span>

          <nav className="rd-foot-legal-links" aria-label="Legal">
            {LEGAL_LINKS.filter((l) => l.href).map((l) => (
              <a key={l.label} href={l.href ?? undefined}>
                {l.label}
              </a>
            ))}
          </nav>

          <div className="rd-foot-prefs">
            <span className="rd-foot-locale">
              <Globe size={14} strokeWidth={1.8} aria-hidden="true" />
              <label className="sr-only" htmlFor="rd-foot-lang">
                Language
              </label>
              <select id="rd-foot-lang" defaultValue="en-US">
                <option value="en-US">English (US)</option>
              </select>
            </span>
          </div>
        </div>

        <p className="rd-foot-disclaimer">
          Planning Ranges Are Estimates, Not Construction Bids. Verify Dimensions, Pricing And Local
          Disclosure Requirements Before Use.
        </p>
      </div>
    </footer>
  );
}
