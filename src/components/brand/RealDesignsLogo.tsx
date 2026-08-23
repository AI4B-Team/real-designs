import "@/styles/rd-brand-logo.css";

/**
 * The single canonical REAL DESIGNS logo.
 *
 * Every surface that shows the brand — app shell, public presentation links,
 * emails, exports, PDFs — must render this component (or the CSS it owns) so
 * the mark can never drift into a typed imitation. Do not re-create the badge
 * with ad-hoc text and letter spacing anywhere else.
 */
export type RealDesignsLogoVariant = "horizontal" | "compact";

export const REAL_DESIGNS_HOME = "https://realdesigns.ai";

export function RealDesignsLogo({
  variant = "horizontal",
  className = "",
  href,
  alt = "REAL DESIGNS",
}: {
  variant?: RealDesignsLogoVariant;
  className?: string;
  href?: string;
  alt?: string;
}) {
  const mark = (
    <span
      className={`rdl-mark rdl-${variant}${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={alt}
      data-logo="real-designs"
      data-variant={variant}
    >
      <i aria-hidden="true">
        <b>REAL</b>
        <em>Designs</em>
      </i>
    </span>
  );
  if (!href) return mark;
  return (
    <a className="rdl-link" href={href} target="_blank" rel="noreferrer noopener" aria-label={alt}>
      {mark}
    </a>
  );
}

/** Responsive pair: full mark on desktop, compact mark on small screens. */
export function RealDesignsLogoResponsive({ href }: { href?: string }) {
  return (
    <span className="rdl-pair">
      <span className="rdl-only-wide">
        <RealDesignsLogo variant="horizontal" href={href} />
      </span>
      <span className="rdl-only-narrow">
        <RealDesignsLogo variant="compact" href={href} />
      </span>
    </span>
  );
}
