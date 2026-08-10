import { Facebook, Instagram, Linkedin, Youtube, Globe } from "lucide-react";

import { FOOTER_COLUMNS, LEGAL_LINKS, POPULAR_TOOL_LINKS } from "@/content/seo/nav";
import "@/styles/rd-footer.css";

function BrandMark() {
  return (
    <span className="rd-mark" aria-label="REAL DESIGNS">
      <i>
        <b>REAL</b>
        <em>Designs</em>
      </i>
    </span>
  );
}


const SOCIALS = [
  { Icon: Instagram, label: "Instagram", href: "https://instagram.com" },
  { Icon: Facebook, label: "Facebook", href: "https://facebook.com" },
  { Icon: Linkedin, label: "LinkedIn", href: "https://linkedin.com" },
  { Icon: Youtube, label: "YouTube", href: "https://youtube.com" },
];

export function GlobalFooter() {
  return (
    <footer className="rd-foot">
      <div className="rd-foot-wrap">
        <div className="rd-foot-grid">
          <div className="rd-foot-brand">
            <a href="/" className="rd-foot-logo" aria-label="REAL DESIGNS Home">
              <BrandMark />
            </a>
            <p>
              AI home design, virtual staging and renovation planning&mdash;from one photo to a
              project-ready plan.
            </p>
            <div className="rd-foot-social">
              {SOCIALS.map(({ Icon, label, href }) => (
                <a key={label} href={href} aria-label={label} rel="noreferrer" target="_blank">
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

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
                      <a href={l.href}>{l.label}</a>
                    </li>
                  ))}
              </ul>
            </details>
          ))}
        </div>

        <div className="rd-foot-tools">
          <span className="rd-foot-tools-lab">Popular Free Tools</span>
          <p>
            {POPULAR_TOOL_LINKS.map((l, i) => (
              <span key={l.href}>
                {i > 0 ? <span aria-hidden="true"> · </span> : null}
                <a href={l.href}>{l.label}</a>
              </span>
            ))}
          </p>
        </div>

        <div className="rd-foot-legal">
          <span className="rd-foot-copy">&copy; 2026 REAL DESIGNS. All rights reserved.</span>

          <nav className="rd-foot-legal-links" aria-label="Legal">
            {LEGAL_LINKS.filter((l) => l.href).map((l) => (
              <a key={l.label} href={l.href}>
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
          Planning ranges are estimates, not construction bids. Verify dimensions, pricing and local
          disclosure requirements before use.
        </p>
      </div>
    </footer>
  );
}
