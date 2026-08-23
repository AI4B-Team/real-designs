import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  safeUrl,
  safeUrlAttr,
  sanitizeLimitedHtml,
  toPlainText,
} from "@/lib/safe-html";
import { checkUrl, isBlockedHost, safeFetch } from "@/lib/safe-fetch.server";
import {
  detectFileKind,
  isSafeStoragePath,
  readImageDimensions,
  validateUploadBytes,
} from "@/lib/upload-guard";
import { pkgCommentSchema } from "@/lib/presentation-packages.schemas";

/* ------------------------------------------------------------------ *
 * Part 1 — unsafe rendering
 * ------------------------------------------------------------------ */

describe("escaping boundary", () => {
  it("neutralizes a script tag", () => {
    const out = escapeHtml("<script>alert(1)</script>");
    expect(out).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).not.toContain("<script");
  });

  it("neutralizes an image event-handler injection", () => {
    const out = escapeHtml('<img src=x onerror="alert(1)">');
    expect(out).not.toMatch(/onerror=/);
    expect(out).toContain("&lt;img");
  });

  it("prevents attribute breakout from double and single quoted attributes", () => {
    const payload = `" onmouseover="alert(1)`;
    const single = `' onmouseover='alert(1)`;
    expect(`<div title="${escapeHtml(payload)}">`).toBe(
      '<div title="&quot; onmouseover=&quot;alert(1)">',
    );
    expect(escapeHtml(single)).not.toContain("'");
    expect(escapeHtml("`x`")).not.toContain("`");
  });

  it("escapes HTML in property, project and room names", () => {
    for (const name of [
      '<img src=x onerror=alert(1)>12 Oak St',
      "<b>Lakeview</b> Listing",
      "Kitchen</div><script>fetch('//evil')</script>",
    ]) {
      const html = `<span class="name">${escapeHtml(name)}</span>`;
      expect(html).not.toMatch(/<(script|img|b)\b/);
    }
  });

  it("drops javascript:, vbscript: and data:text/html URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("JaVaScRiPt:alert(1)")).toBe("");
    expect(safeUrl("java\nscript:alert(1)")).toBe("");
    expect(safeUrl("vbscript:msgbox(1)")).toBe("");
    expect(safeUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe("");
    expect(safeUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe("");
  });

  it("keeps legitimate URLs usable", () => {
    expect(safeUrl("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
    expect(safeUrl("/local/photo.png")).toBe("/local/photo.png");
    expect(safeUrl("blob:https://app.example.com/abc")).toContain("blob:");
    expect(safeUrl("data:image/png;base64,iVBORw0KGgo=")).toContain("data:image/png");
    expect(safeUrlAttr('https://x.test/a.jpg?a=1"onload="x')).not.toContain('"onload');
  });

  it("sanitizes limited HTML down to an allow-list", () => {
    const dirty =
      '<p onclick="steal()">Hi <b>there</b><script>alert(1)</script>' +
      '<img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a>' +
      '<a href="https://ok.test">good</a><iframe src="//evil"></iframe></p>';
    const clean = sanitizeLimitedHtml(dirty);
    expect(clean).not.toMatch(/onclick|onerror|<script|<iframe|<img|javascript:/i);
    expect(clean).toContain("<b>there</b>");
    expect(clean).toContain('href="https://ok.test"');
    expect(clean).toContain('rel="nofollow noopener noreferrer"');
    // The <script> body is dropped, not surfaced as text.
    expect(clean).not.toContain("alert(1)");
  });

  it("rejects a malicious SVG payload in limited HTML", () => {
    const svg = '<svg><script>alert(1)</script><a xlink:href="javascript:alert(1)">x</a></svg>';
    const clean = sanitizeLimitedHtml(svg);
    expect(clean).not.toMatch(/<svg|<script|javascript:|xlink/i);
  });

  it("stores presentation comments as plain text", () => {
    const parsed = pkgCommentSchema.parse({
      token: "6f1c6b8e-2b6b-4a24-9a1f-4f0b0f7b1a11",
      body: '<img src=x onerror="alert(1)"> love the kitchen',
      name: "<script>alert(1)</script>Dana",
    });
    expect(parsed.body).not.toMatch(/[<>]/);
    expect(parsed.body).toContain("love the kitchen");
    expect(parsed.name).not.toContain("<script");
    expect(toPlainText("<b>x</b>  y")).toBe("x y");
  });
});

/* ------------------------------------------------------------------ *
 * Part 2 — URL / SSRF policy
 * ------------------------------------------------------------------ */

describe("URL policy", () => {
  const blocked = [
    "https://localhost/x",
    "https://localhost:8080/x",
    "https://127.0.0.1/x",
    "https://127.1.2.3/x",
    "https://0.0.0.0/x",
    "https://10.0.0.5/x",
    "https://192.168.1.1/x",
    "https://172.16.4.4/x",
    "https://172.31.255.255/x",
    "https://100.64.0.1/x",
    "https://169.254.169.254/latest/meta-data/",
    "https://metadata.google.internal/computeMetadata/v1/",
    "https://[::1]/x",
    "https://[::]/x",
    "https://[fe80::1]/x",
    "https://[fd00::1]/x",
    "https://[::ffff:127.0.0.1]/x",
    "https://internal-api.internal/x",
    "https://printer.local/x",
    "https://intranet/x",
    "https://2130706433/x",
  ];

  it.each(blocked)("rejects %s", (url) => {
    const res = checkUrl(url);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("blocked_host");
  });

  it("rejects non-https schemes and credentials in the URL", () => {
    expect(checkUrl("http://example.com/x")).toMatchObject({ code: "unsupported_scheme" });
    expect(checkUrl("file:///etc/passwd")).toMatchObject({ code: "unsupported_scheme" });
    expect(checkUrl("gopher://example.com/x")).toMatchObject({ code: "unsupported_scheme" });
    expect(checkUrl("https://user:pass@example.com/x")).toMatchObject({
      code: "credentials_in_url",
    });
    expect(checkUrl("http://example.com/x", { allowHttp: true }).ok).toBe(true);
  });

  it("enforces an explicit host allow-list", () => {
    const policy = { allowHosts: ["dropbox.com", "drive.google.com"] };
    expect(checkUrl("https://www.dropbox.com/s/a.jpg", policy).ok).toBe(true);
    expect(checkUrl("https://dl.dropboxusercontent.com/a.jpg", policy)).toMatchObject({
      code: "host_not_allowed",
    });
    expect(checkUrl("https://evil.test/a.jpg", policy)).toMatchObject({ code: "host_not_allowed" });
  });

  it("accepts ordinary public https URLs", () => {
    expect(checkUrl("https://images.example.com/a.jpg").ok).toBe(true);
    expect(isBlockedHost("example.com")).toBe(false);
    expect(isBlockedHost("8.8.8.8")).toBe(false);
  });
});

describe("safeFetch", () => {
  const withFetch = async (impl: typeof fetch, run: () => Promise<unknown>) => {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    try {
      return await run();
    } finally {
      globalThis.fetch = original;
    }
  };

  const res = (body: BodyInit | null, init: ResponseInit) => new Response(body, init);

  it("never issues a request for a blocked host", async () => {
    let called = 0;
    const out = await withFetch(
      (async () => {
        called++;
        return res("x", { status: 200 });
      }) as unknown as typeof fetch,
      () => safeFetch("https://169.254.169.254/latest/meta-data/"),
    );
    expect(called).toBe(0);
    expect(out).toMatchObject({ ok: false, code: "blocked_host" });
  });

  it("revalidates redirect targets and refuses a hop into a private network", async () => {
    const seen: string[] = [];
    const out = await withFetch(
      (async (input: RequestInfo | URL) => {
        seen.push(String(input));
        return res(null, { status: 302, headers: { location: "http://169.254.169.254/" } });
      }) as unknown as typeof fetch,
      () => safeFetch("https://images.example.com/a.jpg"),
    );
    expect(seen).toEqual(["https://images.example.com/a.jpg"]);
    expect(out).toMatchObject({ ok: false });
    // http + metadata host: whichever check fires first, it is not "ok".
    expect((out as { code: string }).code).toMatch(/blocked_host|unsupported_scheme/);
  });

  it("caps redirect count", async () => {
    const out = await withFetch(
      (async () =>
        res(null, {
          status: 301,
          headers: { location: "https://images.example.com/next" },
        })) as unknown as typeof fetch,
      () => safeFetch("https://images.example.com/a.jpg", { maxRedirects: 2 }),
    );
    expect(out).toMatchObject({ ok: false, code: "http_error" });
  });

  it("rejects an oversized response, declared or streamed", async () => {
    const declared = await withFetch(
      (async () =>
        res("x", {
          status: 200,
          headers: { "content-type": "image/jpeg", "content-length": "99999999" },
        })) as unknown as typeof fetch,
      () => safeFetch("https://images.example.com/a.jpg", { maxBytes: 1024 }),
    );
    expect(declared).toMatchObject({ ok: false, code: "too_large" });

    const streamed = await withFetch(
      (async () =>
        res(new Uint8Array(4096), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        })) as unknown as typeof fetch,
      () => safeFetch("https://images.example.com/a.jpg", { maxBytes: 1024 }),
    );
    expect(streamed).toMatchObject({ ok: false, code: "too_large" });
  });

  it("rejects an invalid MIME type and never leaks response headers", async () => {
    const out = await withFetch(
      (async () =>
        res("<html>", {
          status: 200,
          headers: {
            "content-type": "text/html",
            "set-cookie": "session=secret",
            "x-internal-token": "shh",
          },
        })) as unknown as typeof fetch,
      () => safeFetch("https://images.example.com/a.jpg", { allowContentTypes: ["image/"] }),
    );
    expect(out).toMatchObject({ ok: false, code: "bad_content_type" });
    expect(JSON.stringify(out)).not.toContain("secret");
    expect(JSON.stringify(out)).not.toContain("shh");
  });

  it("returns only whitelisted headers on success", async () => {
    const out = (await withFetch(
      (async () =>
        res(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
          status: 200,
          headers: { "content-type": "image/jpeg", "set-cookie": "a=b" },
        })) as unknown as typeof fetch,
      () => safeFetch("https://images.example.com/a.jpg", { allowContentTypes: ["image/"] }),
    )) as { ok: true; headers: Record<string, unknown>; bytes: Uint8Array };
    expect(out.ok).toBe(true);
    expect(Object.keys(out.headers).sort()).toEqual([
      "contentDisposition",
      "contentLength",
      "contentType",
    ]);
    expect(out.bytes.byteLength).toBe(4);
  });
});

/* ------------------------------------------------------------------ *
 * Part 3 — uploads
 * ------------------------------------------------------------------ */

const jpeg = (extra = 0) => {
  const b = new Uint8Array(64 + extra);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
};
const png = (w: number, h: number) => {
  const b = new Uint8Array(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const v = new DataView(b.buffer);
  v.setUint32(16, w);
  v.setUint32(20, h);
  return b;
};
const bytesOf = (s: string) => new TextEncoder().encode(s);

describe("upload guard", () => {
  it("detects real formats from bytes, not names", () => {
    expect(detectFileKind(jpeg())).toBe("image/jpeg");
    expect(detectFileKind(png(10, 10))).toBe("image/png");
    expect(detectFileKind(bytesOf("<svg xmlns='x'><script/></svg>"))).toBe("image/svg+xml");
    expect(detectFileKind(bytesOf("MZ\u0090\u0000executable"))).toBe("application/x-executable");
    expect(detectFileKind(bytesOf("%PDF-1.7\n"))).toBe("application/pdf");
  });

  it("rejects a renamed executable claiming to be a photo", () => {
    const verdict = validateUploadBytes("room-photos", bytesOf("MZ\u0090\u0000payload"), "image/jpeg");
    expect(verdict).toMatchObject({ ok: false, code: "executable_rejected" });
  });

  it("rejects a malicious SVG upload outright", () => {
    const verdict = validateUploadBytes(
      "room-photos",
      bytesOf('<svg onload="alert(1)"><script>alert(1)</script></svg>'),
      "image/svg+xml",
    );
    expect(verdict).toMatchObject({ ok: false, code: "svg_rejected" });
  });

  it("rejects a PDF uploaded as a photo (never parsed, never executed)", () => {
    expect(validateUploadBytes("room-photos", bytesOf("%PDF-1.7\n%..."), "image/png")).toMatchObject(
      { ok: false },
    );
  });

  it("rejects a declared type that disagrees with the bytes", () => {
    expect(validateUploadBytes("room-photos", jpeg(), "video/mp4")).toMatchObject({
      ok: false,
      code: "declared_type_mismatch",
    });
  });

  it("rejects an oversized file and an oversized image", () => {
    const big = new Uint8Array(16 * 1024 * 1024);
    big.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateUploadBytes("room-photos", big, "image/jpeg")).toMatchObject({
      ok: false,
      code: "too_large",
    });
    expect(validateUploadBytes("room-photos", png(30000, 30000), "image/png")).toMatchObject({
      ok: false,
      code: "dimensions_too_large",
    });
  });

  it("accepts a legitimate photo and reads its dimensions", () => {
    const verdict = validateUploadBytes("room-photos", png(1600, 900), "image/png");
    expect(verdict).toMatchObject({ ok: true, kind: "image/png", width: 1600, height: 900 });
    expect(readImageDimensions(png(4, 5))).toEqual({ width: 4, height: 5 });
    expect(validateUploadBytes("room-photos", jpeg(), "image/jpeg").ok).toBe(true);
  });

  it("only accepts storage paths inside the caller's own folder", () => {
    const uid = "6f1c6b8e-2b6b-4a24-9a1f-4f0b0f7b1a11";
    expect(isSafeStoragePath(`${uid}/photo-1.jpg`, uid)).toBe(true);
    expect(isSafeStoragePath(`other-user/photo-1.jpg`, uid)).toBe(false);
    expect(isSafeStoragePath(`${uid}/../other/photo.jpg`, uid)).toBe(false);
    expect(isSafeStoragePath(`/${uid}/photo.jpg`, uid)).toBe(false);
    expect(isSafeStoragePath(`${uid}/a\u0000b.jpg`, uid)).toBe(false);
  });

  it("refuses an unknown bucket", () => {
    expect(validateUploadBytes("secrets", jpeg(), "image/jpeg")).toMatchObject({
      ok: false,
      code: "unknown_bucket",
    });
  });
});
