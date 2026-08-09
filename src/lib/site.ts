/** Canonical production origin for REAL DESIGNS. Used for canonical/og URLs and sitemap. */
export const SITE_URL = "https://realdesigns.ai";

export const absoluteUrl = (path: string) =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
