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
  return <GlobalFooter />;
}


