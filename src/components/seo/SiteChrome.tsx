import { Link } from "@tanstack/react-router";

import { FOOTER_GROUPS, POPULAR_TOOL_LINKS } from "@/content/seo/nav";


export function BrandMark() {
  return (
    <span className="rd-mark" aria-label="REAL DESIGNS">
      <i>
        <b>REAL</b>
        <em>Designs</em>
      </i>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header id="hdr">
      <div className="wrap nav">
        <a href="/" className="logo">
          <BrandMark />
        </a>

        <div className="nav-cta">
          <Link to="/auth" className="btn btn-ghost btn-sm">
            Log In
          </Link>
          <a href="#builder" className="btn btn-primary btn-sm">
            Upload Your Space
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="foot">
          <div className="foot-brand">
            <div style={{ marginBottom: 13 }}>
              <BrandMark />
            </div>
            <p>
              AI home design, virtual staging and renovation planning&mdash;from one photo to a
              project-ready plan.
            </p>
          </div>
          {FOOTER_GROUPS.map((g) => (
            <details className="foot-col" key={g.heading} open>
              <summary>
                <h4>{g.heading}</h4>
              </summary>
              <ul>
                {g.links.map((l) => (
                  <li key={`${g.heading}-${l.href}`}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        <div className="foot-tools">
          <span className="mono">Popular Free Tools</span>
          <p>
            {POPULAR_TOOL_LINKS.map((l, i) => (
              <span key={l.href}>
                {i > 0 ? " · " : null}
                <a href={l.href}>{l.label}</a>
              </span>
            ))}
          </p>
        </div>

        <div className="foot-b">
          <span>&copy; 2026 REAL DESIGNS. All rights reserved.</span>
          <span className="mono">
            Planning ranges are estimates, not construction bids. Disclose virtually staged images
            where required.
          </span>
        </div>
      </div>
    </footer>
  );
}

