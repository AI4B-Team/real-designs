/**
 * Listing import — server-only helpers.
 *
 * The only network access this module performs is against an *authorized*
 * listing-data provider (a licensed API). Public listing pages are never
 * fetched, scraped or proxied: no login wall, CAPTCHA, robots directive or
 * other access control is bypassed anywhere in this file.
 */

export type ProviderMatch = { id: string; name: string; supported: boolean };

/** Domains the UI is allowed to recognize. Nothing outside this list is accepted. */
const ALLOWED: Array<[RegExp, string, string]> = [
  [/^(www\.)?zillow\.com$/i, "zillow", "Zillow"],
  [/^(www\.)?realtor\.com$/i, "realtor", "Realtor.com"],
  [/^(www\.)?redfin\.com$/i, "redfin", "Redfin"],
  [/^(www\.)?homes\.com$/i, "homes", "Homes.com"],
  [/^(www\.)?trulia\.com$/i, "trulia", "Trulia"],
  [/^(www\.)?compass\.com$/i, "compass", "Compass"],
];

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?fc00:|\[?fd)/i;

export type UrlCheck =
  | {
      ok: false;
      code: "invalid_url" | "unsupported_protocol" | "blocked_host" | "unsupported_provider";
      message: string;
    }
  | { ok: true; url: string; host: string; provider: ProviderMatch };

/** Validate + normalize a pasted listing link. Pure string work — no requests. */
export function checkListingUrl(raw: string): UrlCheck {
  const input = String(raw || "").trim();
  if (!input)
    return { ok: false, code: "invalid_url", message: "Paste a listing link to continue." };

  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, code: "invalid_url", message: "That does not look like a listing link." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, code: "unsupported_protocol", message: "Only https links are supported." };
  }
  const host = url.hostname.toLowerCase();
  if (PRIVATE_HOST.test(host) || !host.includes(".")) {
    return {
      ok: false,
      code: "blocked_host",
      message: "That address is not a public listing link.",
    };
  }
  const hit = ALLOWED.find(([re]) => re.test(host));
  if (!hit) {
    return {
      ok: false,
      code: "unsupported_provider",
      message: "That listing site is not supported yet.",
    };
  }
  // Strip query strings and fragments: they carry tracking, not listing identity.
  const normalized = `https://${host}${url.pathname.replace(/\/+$/, "")}`;
  return {
    ok: true,
    url: normalized,
    host,
    provider: { id: hit[1], name: hit[2], supported: true },
  };
}

export type ProviderFetch =
  | { ok: true; listing: Record<string, unknown>; photos: Array<Record<string, unknown>> }
  | { ok: false; code: "provider_not_connected" | "provider_error"; message: string };

/**
 * Call the licensed listing-data provider.
 *
 * Until LISTING_DATA_API_URL / LISTING_DATA_API_KEY are configured there is no
 * compliant connector, so we report that honestly instead of inventing data.
 */
export async function fetchListing(
  normalizedUrl: string,
  providerId: string,
): Promise<ProviderFetch> {
  const base = process.env["LISTING_DATA_API_URL"];
  const key = process.env["LISTING_DATA_API_KEY"];
  if (!base || !key) {
    return {
      ok: false,
      code: "provider_not_connected",
      message:
        "We couldn't automatically import this listing. Upload the photos instead or select an existing property.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/listings?url=${encodeURIComponent(normalizedUrl)}`,
      {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        redirect: "error",
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        code: "provider_error",
        message: `The listing provider returned ${res.status}.`,
      };
    }
    const raw = await res.text();
    if (raw.length > 2_000_000) {
      return {
        ok: false,
        code: "provider_error",
        message: "The listing response was too large to process.",
      };
    }
    const data = JSON.parse(raw) as any;
    return {
      ok: true,
      listing: sanitizeListing(data?.listing ?? data, providerId),
      photos: sanitizePhotos(data?.photos ?? []),
    };
  } catch (e: any) {
    return {
      ok: false,
      code: "provider_error",
      message:
        e?.name === "AbortError"
          ? "The listing provider timed out."
          : "The listing provider is unavailable.",
    };
  } finally {
    clearTimeout(timer);
  }
}

const text = (v: unknown, max = 400) =>
  String(v == null ? "" : v)
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, max);

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function sanitizeListing(raw: any, providerId: string) {
  return {
    address: text(raw?.address, 240),
    title: text(raw?.title, 200),
    price: num(raw?.price),
    beds: num(raw?.beds ?? raw?.bedrooms),
    baths: num(raw?.baths ?? raw?.bathrooms),
    sqft: num(raw?.sqft ?? raw?.living_area),
    description: text(raw?.description, 4000),
    agent: text(raw?.agent ?? raw?.agent_name, 160),
    brokerage: text(raw?.brokerage, 160),
    provider_id: providerId,
  };
}

function sanitizePhotos(raw: any) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 120).map((p: any, i: number) => ({
    url: text(p?.url ?? p, 1000),
    caption: text(p?.caption, 200),
    order: i,
  }));
}

/**
 * Look a listing up by street address through the same licensed provider.
 * No public listing page is fetched. Returns a not-connected result when no
 * provider credentials are configured, so the UI can fall back to confirming
 * the address the user typed.
 */
export async function fetchListingByAddress(address: string): Promise<ProviderFetch> {
  const base = process.env["LISTING_DATA_API_URL"];
  const key = process.env["LISTING_DATA_API_KEY"];
  if (!base || !key) {
    return {
      ok: false,
      code: "provider_not_connected",
      message: "Automatic listing lookup is not connected yet.",
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/listings?address=${encodeURIComponent(address)}`,
      {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        redirect: "error",
        signal: controller.signal,
      },
    );
    if (!res.ok)
      return {
        ok: false,
        code: "provider_error",
        message: `The listing provider returned ${res.status}.`,
      };
    const raw = await res.text();
    if (raw.length > 2_000_000)
      return {
        ok: false,
        code: "provider_error",
        message: "The listing response was too large to process.",
      };
    const data = JSON.parse(raw) as any;
    const first = Array.isArray(data?.listings) ? data.listings[0] : (data?.listing ?? data);
    if (!first)
      return { ok: false, code: "provider_error", message: "No listing matched that address." };
    return {
      ok: true,
      listing: sanitizeListing(first, String(first?.provider_id || "address")),
      photos: sanitizePhotos(data?.photos ?? first?.photos ?? []),
    };
  } catch (e: any) {
    return {
      ok: false,
      code: "provider_error",
      message:
        e?.name === "AbortError"
          ? "The listing provider timed out."
          : "The listing provider is unavailable.",
    };
  } finally {
    clearTimeout(timer);
  }
}
