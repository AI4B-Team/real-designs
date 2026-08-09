import { Link } from "@tanstack/react-router";

import { FOOTER_GROUPS } from "@/content/seo/nav";

const logo =
  "/__l5e/assets-v1/c5d9393c-b749-4c1a-81d3-2af5cbe5c8c3/rd-logo-icon.png";

export function SiteHeader() {
  return (
    <header id="hdr">
      <div className="wrap nav">
        <a href="/" className="logo">
          <img src={logo} alt="REAL DESIGNS" className="dot" />
          REAL DESIGNS <small>.AI</small>
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
        <div className="foot lp-foot">
          <div>
            <div
              style={{
                color: "#fff",
                fontWeight: 700,
                letterSpacing: "-.03em",
                fontSize: "1.08rem",
                display: "flex",
                alignItems: "center",
                gap: 9,
                marginBottom: 11,
              }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  background: "var(--red)",
                  display: "block",
                }}
              />
              REAL DESIGNS
            </div>
            <p style={{ maxWidth: "33ch", fontSize: ".84rem" }}>
              AI home design, virtual staging and renovation planning for people who actually own
              the property.
            </p>
            <p style={{ maxWidth: "33ch", fontSize: ".84rem", marginTop: 10 }}>
              <a href="/">Home</a> &middot; <a href="/#pricing">Pricing</a>
              <br />
              <a href="/terms">Terms</a> &middot; <a href="/privacy">Privacy</a> &middot;{" "}
              <a href="/refund-policy">Refunds</a>

            </p>
          </div>
          {FOOTER_GROUPS.map((g) => (
            <div key={g.heading}>
              <h4>{g.heading}</h4>
              <ul>
                {g.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="foot-b">
          <span>Copyright 2026 REAL DESIGNS. All rights reserved.</span>
          <span className="mono">
            Cost figures are planning estimates, not construction bids. Staged images are labeled
            per MLS and state rules.
          </span>
        </div>
      </div>
    </footer>
  );
}
