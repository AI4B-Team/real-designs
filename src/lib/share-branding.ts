/**
 * Canonical branding resolver for every recipient-facing surface:
 * quick approval pages, presentations, PDFs, emails, loading and empty states.
 *
 * The rule the product depends on: REAL DESIGNS never invents a company name.
 * A workspace brand is shown only when the sender configured one AND it was
 * verified. Anything else falls back to the official REAL DESIGNS mark.
 */

export type WorkspaceBrand = {
  name?: string | null;
  logo_url?: string | null;
  /** True only when the workspace brand was explicitly confirmed by the sender. */
  verified?: boolean | null;
  accent?: string | null;
};

export type ShareBranding = {
  /** "official" renders the REAL DESIGNS mark alone. */
  kind: "official" | "workspace";
  /** Workspace display name, never derived from property or account data. */
  name: string | null;
  logoUrl: string | null;
  /** Secondary "Powered by REAL DESIGNS" line under a workspace brand. */
  poweredBy: boolean;
  accent: string;
};

export const DEFAULT_ACCENT = "#CC0000";
export const POWERED_BY = "Powered by REAL DESIGNS";

const clean = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
};

const safeAccent = (v: unknown): string =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : DEFAULT_ACCENT;

/** Only https URLs are trusted for a recipient-facing logo. */
const safeLogo = (v: unknown): string | null => {
  const t = clean(v);
  if (!t) return null;
  return /^https:\/\//i.test(t) ? t : null;
};

export function resolveShareBranding(brand: WorkspaceBrand | null | undefined): ShareBranding {
  const accent = safeAccent(brand?.accent);
  const name = clean(brand?.name);
  const verified = brand?.verified === true;
  if (!name || !verified) {
    return { kind: "official", name: null, logoUrl: null, poweredBy: false, accent };
  }
  return { kind: "workspace", name, logoUrl: safeLogo(brand?.logo_url), poweredBy: true, accent };
}

/** One-line preview of what the recipient will see, shown before link creation. */
export function brandingPreviewLine(brand: WorkspaceBrand | null | undefined): string {
  const b = resolveShareBranding(brand);
  if (b.kind === "official") return "Recipients see the official REAL DESIGNS branding.";
  return `Recipients see ${b.name} with “${POWERED_BY}”.`;
}

/** Guards against a company brand being derived from unrelated data. */
export function isInventedBrand(name: unknown, context: { address?: string | null } = {}): boolean {
  const n = clean(name);
  if (!n) return false;
  const addr = clean(context.address);
  return !!addr && addr.toLowerCase().includes(n.toLowerCase());
}
