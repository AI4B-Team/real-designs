/**
 * REAL DESIGNS — the single reviewed outbound-fetch boundary.
 *
 * Every server-side request whose URL is influenced by user input (listing
 * links, cloud-share links, remote images, branding logos, CRM webhooks,
 * watched sites) goes through `safeFetch`. Requests to hard-coded provider
 * endpoints configured by environment variables do not — those are operator
 * controlled, not user controlled.
 *
 * Policy (see docs/SECURITY_URL_POLICY.md):
 *  - https only, unless the caller opts into http for a documented case
 *  - no embedded credentials
 *  - no localhost / loopback / private / link-local / CGNAT / metadata hosts,
 *    for both IPv4 and IPv6, checked on the initial URL *and every redirect*
 *  - manual redirect handling, capped
 *  - response-size cap, request timeout, content-type allow-list
 *  - response headers are never handed back to the caller wholesale
 */

export type UrlPolicy = {
  /** Only these hostnames (exact or suffix after a dot) may be contacted. */
  allowHosts?: string[];
  /** Permit http: as well as https: — must be justified at the call site. */
  allowHttp?: boolean;
  maxRedirects?: number;
  maxBytes?: number;
  timeoutMs?: number;
  /** Allowed response content types, matched against the type prefix. */
  allowContentTypes?: string[];
};

export type UrlRejection =
  | "invalid_url"
  | "unsupported_scheme"
  | "credentials_in_url"
  | "blocked_host"
  | "host_not_allowed";

export type UrlCheckResult =
  | { ok: true; url: URL }
  | { ok: false; code: UrlRejection; message: string };

const MESSAGES: Record<UrlRejection, string> = {
  invalid_url: "That does not look like a valid web address.",
  unsupported_scheme: "Only https links are supported.",
  credentials_in_url: "Links containing a username or password are not supported.",
  blocked_host: "That address is not publicly reachable and cannot be fetched.",
  host_not_allowed: "That host is not on the supported list.",
};

/** Cloud metadata services and other well-known internal endpoints. */
const METADATA_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
  "instance-data",
  "100.100.100.200",
]);

const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".home.arpa", ".onion"];

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums as [number, number, number, number];
  if (a === 0) return true; // "this network"
  if (a === 10) return true;
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (incl. metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function isPrivateIPv6(raw: string): boolean {
  const host = raw.replace(/^\[|\]$/g, "").toLowerCase().split("%")[0] ?? "";
  if (!host.includes(":")) return false;
  if (host === "::" || host === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true; // unique local fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(host)) return true; // link-local fe80::/10
  if (/^ff[0-9a-f]{2}:/.test(host)) return true; // multicast
  // IPv4-mapped / -compatible: ::ffff:127.0.0.1, ::ffff:169.254.169.254
  const v4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(host);
  if (v4 && (host.startsWith("::") || host.startsWith("64:ff9b:"))) {
    return isPrivateIPv4(v4[1] as string);
  }
  return false;
}

/** True when the literal hostname must never be contacted. */
export function isBlockedHost(hostname: string): boolean {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (METADATA_HOSTS.has(host)) return true;
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (isPrivateIPv4(host)) return true;
  if (isPrivateIPv6(host)) return true;
  // Decimal / octal / hex encodings of an IPv4 address (e.g. 2130706433).
  if (/^\d+$/.test(host)) {
    const n = Number(host);
    if (Number.isFinite(n) && n <= 0xffffffff) {
      const dotted = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
      if (isPrivateIPv4(dotted)) return true;
    }
    return true;
  }
  if (/^0x[0-9a-f]+$/.test(host)) return true;
  // A bare label with no dot is an internal name in every deployment we run.
  if (!host.includes(".") && !host.includes(":")) return true;
  return false;
}

function hostAllowed(host: string, allow: string[] | undefined): boolean {
  if (!allow || allow.length === 0) return true;
  const h = host.toLowerCase().replace(/^www\./, "");
  return allow.some((a) => {
    const t = a.toLowerCase().replace(/^www\./, "");
    return h === t || h.endsWith("." + t);
  });
}

/** Validate a single URL against the policy. Pure — performs no requests. */
export function checkUrl(raw: unknown, policy: UrlPolicy = {}): UrlCheckResult {
  const input = String(raw ?? "").trim();
  if (!input) return reject("invalid_url");
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return reject("invalid_url");
  }
  const scheme = url.protocol.toLowerCase();
  if (scheme !== "https:" && !(policy.allowHttp && scheme === "http:")) {
    return reject("unsupported_scheme");
  }
  if (url.username || url.password) return reject("credentials_in_url");
  if (isBlockedHost(url.hostname)) return reject("blocked_host");
  if (!hostAllowed(url.hostname, policy.allowHosts)) return reject("host_not_allowed");
  return { ok: true, url };
}

function reject(code: UrlRejection): UrlCheckResult {
  return { ok: false, code, message: MESSAGES[code] };
}

export type SafeFetchResult =
  | {
      ok: true;
      url: string;
      status: number;
      contentType: string;
      bytes: Uint8Array;
      /** Only the small set of headers callers legitimately need. */
      headers: { contentType: string; contentLength: number | null; contentDisposition: string };
    }
  | {
      ok: false;
      code: UrlRejection | "http_error" | "too_large" | "timeout" | "bad_content_type" | "network";
      status?: number;
      message: string;
    };

const DEFAULTS = {
  maxRedirects: 3,
  maxBytes: 15 * 1024 * 1024,
  timeoutMs: 15_000,
};

/**
 * Fetch a user-influenced URL under the policy above and return the body as
 * bytes. Redirects are followed manually so each hop is revalidated; response
 * headers other than the three below are discarded so nothing a redirect
 * target sets (cookies, auth echoes) can leak to a client.
 */
export async function safeFetch(
  raw: unknown,
  policy: UrlPolicy = {},
  init?: { headers?: Record<string, string>; method?: string },
): Promise<SafeFetchResult> {
  const maxRedirects = policy.maxRedirects ?? DEFAULTS.maxRedirects;
  const maxBytes = policy.maxBytes ?? DEFAULTS.maxBytes;
  const timeoutMs = policy.timeoutMs ?? DEFAULTS.timeoutMs;

  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    // Every hop, including redirect targets, gets the identical check. A
    // redirect may leave the allow-list host set, so the policy is unchanged.
    const check = checkUrl(current, policy);
    if (!check.ok) return { ok: false, code: check.code, message: check.message };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(check.url.toString(), {
        method: init?.method ?? "GET",
        headers: { "user-agent": "RealDesigns/1.0", ...(init?.headers ?? {}) },
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timer);
      return e?.name === "AbortError"
        ? { ok: false, code: "timeout", message: "That address took too long to respond." }
        : { ok: false, code: "network", message: "That address could not be reached." };
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        return { ok: false, code: "http_error", status: res.status, message: "Redirect without a target." };
      }
      current = new URL(location, check.url).toString();
      continue;
    }

    if (!res.ok) {
      return {
        ok: false,
        code: "http_error",
        status: res.status,
        message: `That address returned ${res.status}.`,
      };
    }

    const contentType = ((res.headers.get("content-type") || "").split(";")[0] || "")
      .trim()
      .toLowerCase();
    if (
      policy.allowContentTypes?.length &&
      !policy.allowContentTypes.some((t) => contentType === t || contentType.startsWith(t))
    ) {
      return {
        ok: false,
        code: "bad_content_type",
        message: `That link is not a supported file type${contentType ? ` (${contentType})` : ""}.`,
      };
    }

    const declared = Number(res.headers.get("content-length") || "");
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { ok: false, code: "too_large", message: "That file is larger than we can process." };
    }

    const bytes = await readCapped(res, maxBytes);
    if (!bytes) {
      return { ok: false, code: "too_large", message: "That file is larger than we can process." };
    }

    return {
      ok: true,
      url: check.url.toString(),
      status: res.status,
      contentType,
      bytes,
      headers: {
        contentType,
        contentLength: Number.isFinite(declared) ? declared : null,
        contentDisposition: res.headers.get("content-disposition") || "",
      },
    };
  }

  return { ok: false, code: "http_error", message: "That link redirected too many times." };
}

/** Stream the body, aborting as soon as the cap is exceeded. */
async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > maxBytes ? null : buf;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* the connection is being torn down anyway */
      }
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}
