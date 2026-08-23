/**
 * REAL DESIGNS — the single reviewed escaping/sanitization boundary.
 *
 * The prototype runtime builds most of its UI from template strings assigned
 * to `innerHTML`. Rather than rewrite that runtime (out of scope), every
 * dynamic value that reaches such a template must pass through exactly one of
 * the three functions below:
 *
 *  - `escapeHtml`  — plain text in element content or a quoted attribute.
 *                    This is the default and covers ~99% of call sites.
 *  - `safeUrl`     — anything interpolated into href/src/poster/background.
 *                    Only http(s), mailto, tel, blob and image/video data URLs
 *                    survive; `javascript:` and friends collapse to "".
 *  - `sanitizeLimitedHtml` — the rare place that intentionally renders limited
 *                    markup (rich notes). Tag + attribute allow-list, no event
 *                    handlers, no <script>/<style>, no unsafe URLs, no inline
 *                    styles.
 *
 * Nothing here depends on the DOM, so it is usable on the server and in tests.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};

/**
 * Escape text for HTML element content *and* for quoted attribute values.
 * Backtick and single quote are included so an unquoted-ish or single-quoted
 * attribute cannot be broken out of.
 */
export function escapeHtml(value: unknown): string {
  return String(value == null ? "" : value).replace(
    /[&<>"'`]/g,
    (c) => HTML_ESCAPES[c] as string,
  );
}

/** Alias used where the intent is specifically an attribute value. */
export const escapeAttr = escapeHtml;

/** Escape a value for a `"..."` JS string inside an inline handler/JSON blob. */
export function escapeJsString(value: unknown): string {
  return JSON.stringify(String(value == null ? "" : value))
    .slice(1, -1)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:", "blob:"]);
/** Data URLs are only allowed for inert media types. */
const SAFE_DATA = /^data:(image\/(png|jpe?g|gif|webp|avif|bmp)|video\/(mp4|webm)|audio\/(mpeg|wav|webm|mp4));base64,[a-z0-9+/=\s]*$/i;

/**
 * Return a URL that is safe to place in an href/src attribute, or "" when it
 * is not. Relative URLs and fragments are allowed (they cannot change scheme).
 */
export function safeUrl(value: unknown): string {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return "";
  // Strip control characters first: "java\nscript:alert(1)" is a real payload.
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, "");
  if (SAFE_DATA.test(cleaned)) return cleaned;
  if (/^data:/i.test(cleaned)) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) {
    let parsed: URL;
    try {
      parsed = new URL(cleaned);
    } catch {
      return "";
    }
    return SAFE_SCHEMES.has(parsed.protocol.toLowerCase()) ? cleaned : "";
  }
  // Scheme-relative and path-relative URLs inherit the current origin's scheme.
  if (/^[\\/]/.test(cleaned) || /^[#?]/.test(cleaned) || /^[.\w]/.test(cleaned)) return cleaned;
  return "";
}

/** `safeUrl`, already escaped for direct interpolation into an attribute. */
export function safeUrlAttr(value: unknown): string {
  return escapeHtml(safeUrl(value));
}

/** Assign untrusted text to an element without ever parsing markup. */
export function setText(el: Element | null | undefined, value: unknown): void {
  if (el) el.textContent = String(value == null ? "" : value);
}

/* ------------------------------------------------------------------ *
 * Limited-HTML sanitizer
 * ------------------------------------------------------------------ */

const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "u",
  "ul",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
};

const VOID_TAGS = new Set(["br"]);

/**
 * Sanitize limited rich text. Implemented as a hand-rolled tokenizer rather
 * than DOM parsing so it behaves identically on the server, in workers and in
 * tests. Anything not explicitly allowed is dropped and its text content is
 * escaped — sanitization never "repairs" markup into something executable.
 */
export function sanitizeLimitedHtml(input: unknown): string {
  const src = String(input == null ? "" : input);
  let out = "";
  const open: string[] = [];
  let i = 0;

  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt === -1) {
      out += escapeHtml(src.slice(i));
      break;
    }
    out += escapeHtml(src.slice(i, lt));

    const gt = src.indexOf(">", lt);
    if (gt === -1) {
      out += escapeHtml(src.slice(lt));
      break;
    }
    const rawTag = src.slice(lt + 1, gt);
    i = gt + 1;

    // Comments, CDATA, doctype, processing instructions: dropped entirely.
    if (/^[!?]/.test(rawTag)) continue;

    const closing = rawTag.startsWith("/");
    const name = (closing ? rawTag.slice(1) : rawTag).trim().split(/[\s/>]/)[0]?.toLowerCase() ?? "";

    if (!ALLOWED_TAGS.has(name)) {
      // <script>/<style> also have their *content* dropped, not escaped —
      // escaping it would surface attacker text as visible page content.
      if (!closing && (name === "script" || name === "style")) {
        const end = src.toLowerCase().indexOf(`</${name}`, i);
        i = end === -1 ? src.length : (src.indexOf(">", end) + 1 || src.length);
      }
      continue;
    }

    if (closing) {
      const idx = open.lastIndexOf(name);
      if (idx === -1) continue;
      while (open.length > idx) out += `</${open.pop()}>`;
      continue;
    }

    const attrs = sanitizeAttrs(name, rawTag.slice(name.length));
    if (VOID_TAGS.has(name)) {
      out += `<${name}${attrs}>`;
    } else {
      out += `<${name}${attrs}>`;
      open.push(name);
    }
  }

  while (open.length) out += `</${open.pop()}>`;
  return out;
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

function sanitizeAttrs(tag: string, rest: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";
  let out = "";
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(rest))) {
    const key = (m[1] || "").toLowerCase();
    // Event handlers and style are never allowed anywhere, on any tag.
    if (key.startsWith("on") || key === "style" || !allowed.has(key)) continue;
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    if (key === "href") {
      const url = safeUrl(value);
      if (!url) continue;
      out += ` href="${escapeHtml(url)}" rel="nofollow noopener noreferrer" target="_blank"`;
      continue;
    }
    out += ` ${key}="${escapeHtml(value)}"`;
  }
  return out;
}

/** Strip all markup and collapse whitespace — for titles, alt text, toasts. */
export function toPlainText(input: unknown, max = 2000): string {
  return String(input == null ? "" : input)
    .replace(/<[^>]*>/g, " ")
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
