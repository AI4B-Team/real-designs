/**
 * Listing link handling.
 *
 * A pasted listing URL is only ever *read as text*: we identify the provider
 * and, where the address is already present in the link itself, normalize it.
 * Nothing is fetched, no bot protection, authentication or CAPTCHA is
 * bypassed, and media is never imported from a public listing page. Media only
 * arrives through an upload or an expressly authorized connected source.
 */

export type ListingProvider = {
  id: string;
  name: string;
  /** True only when this workspace has an authorized media connection. */
  authorized: boolean;
};

const PROVIDERS: Array<[RegExp, string, string]> = [
  [/(^|\.)zillow\.com$/i, "zillow", "Zillow"],
  [/(^|\.)realtor\.com$/i, "realtor", "Realtor.com"],
  [/(^|\.)redfin\.com$/i, "redfin", "Redfin"],
  [/(^|\.)homes\.com$/i, "homes", "Homes.com"],
  [/(^|\.)trulia\.com$/i, "trulia", "Trulia"],
  [/(^|\.)compass\.com$/i, "compass", "Compass"],
  [/(^|\.)apartments\.com$/i, "apartments", "Apartments.com"],
  [/(^|\.)zillowstatic\.com$/i, "zillow", "Zillow"],
];

const STATES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";

/** Title Case a normalized address while leaving the state code upper case. */
export function normalizeAddress(raw: string): string {
  const cleaned = String(raw || "")
    .replace(/[-_+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((w) => {
      if (new RegExp(`^(${STATES})$`, "i").test(w)) return w.toUpperCase();
      if (/^\d/.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\b([A-Z]{2})\s(\d{5})\b/, "$1 $2");
}

export type ListingLinkResult = {
  ok: boolean;
  provider: ListingProvider | null;
  address: string;
  message: string;
};

/**
 * Identify the provider and, when the link already spells the address out,
 * read it. No network request is made.
 */
export function identifyListing(input: string): ListingLinkResult {
  const raw = String(input || "").trim();
  if (!raw)
    return { ok: false, provider: null, address: "", message: "Paste a listing link to continue." };

  let url: URL | null = null;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    url = null;
  }
  if (!url) {
    return {
      ok: false,
      provider: null,
      address: "",
      message: "That does not look like a listing link.",
    };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, provider: null, address: "", message: "Only web links are supported." };
  }

  const host = url.hostname.toLowerCase();
  const match = PROVIDERS.find(([re]) => re.test(host));
  const provider: ListingProvider = match
    ? { id: match[1], name: match[2], authorized: false }
    : { id: "other", name: host.replace(/^www\./, ""), authorized: false };

  const address = addressFromPath(url.pathname);
  return {
    ok: true,
    provider,
    address,
    message: address
      ? `We found the property on ${provider.name}.`
      : `We recognized ${provider.name}, but the address is not readable from that link.`,
  };
}

/** Pull an address out of a listing slug such as /homedetails/1420-Bayshore-Blvd-Tampa-FL-33606/. */
function addressFromPath(pathname: string): string {
  const parts = decodeURIComponent(pathname || "")
    .split("/")
    .filter(Boolean);
  const re = new RegExp(`^\\d+[-_].+[-_](${STATES})([-_]\\d{5})?$`, "i");
  const slug = parts.reverse().find((p) => re.test(p));
  if (!slug) return "";
  const cleaned = slug.replace(
    new RegExp(`[-_](${STATES})([-_](\\d{5}))?$`, "i"),
    (_m, st, _g, zip) => ` ${String(st).toUpperCase()}${zip ? " " + zip : ""}`,
  );
  const idx = cleaned.search(new RegExp(`\\s(${STATES})(\\s\\d{5})?$`, "i"));
  if (idx > 0) {
    const head = cleaned.slice(0, idx);
    const tail = cleaned.slice(idx);
    const bits = head.split(/[-_]/).filter(Boolean);
    const city = bits.length > 1 ? bits.pop() : "";
    return normalizeAddress(`${bits.join(" ")}${city ? ", " + city : ""}${tail}`);
  }
  return normalizeAddress(cleaned);
}

/** Wording used whenever direct media import is not authorized. */
export const NO_IMPORT_MESSAGE =
  "We found the property. Upload the original listing photos or connect a supported media source to continue.";
