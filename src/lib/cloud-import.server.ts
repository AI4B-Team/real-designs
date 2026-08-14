/**
 * Cloud share-link import helpers.
 *
 * Only public share links from Google Drive and Dropbox are accepted, and the
 * server only ever fetches the direct-download form of those allowlisted hosts.
 * No arbitrary URL proxying: anything outside the allowlist is rejected before
 * a request is made.
 */

const MAX_BYTES = 15 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif", "image/webp"];

export type CloudLink = { provider: "google_drive" | "dropbox"; url: string; name: string };

export function normalizeCloudLink(raw: string): { ok: true; link: CloudLink } | { ok: false; message: string } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, message: "Not a valid link" };
  }
  if (u.protocol !== "https:") return { ok: false, message: "Link must start with https" };
  const host = u.hostname.toLowerCase();

  if (host === "drive.google.com" || host === "docs.google.com") {
    const m = u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/) || u.pathname.match(/\/d\/([A-Za-z0-9_-]{10,})/);
    const id = m?.[1] || u.searchParams.get("id");
    if (!id) {
      return { ok: false, message: u.pathname.includes("/folders/") ? "Folder links are not supported — share individual photo links" : "Could not read the Drive file ID" };
    }
    return { ok: true, link: { provider: "google_drive", url: `https://drive.google.com/uc?export=download&id=${id}`, name: `drive-${id}` } };
  }

  if (host === "www.dropbox.com" || host === "dropbox.com" || host === "dl.dropboxusercontent.com") {
    if (/\/(scl\/fo|sh)\//.test(u.pathname) && !u.pathname.includes("/scl/fi/")) {
      return { ok: false, message: "Folder links are not supported — share individual photo links" };
    }
    u.searchParams.set("dl", "1");
    const name = decodeURIComponent(u.pathname.split("/").pop() || "dropbox-photo");
    return { ok: true, link: { provider: "dropbox", url: u.toString(), name } };
  }

  return { ok: false, message: "Only Google Drive and Dropbox share links are supported" };
}

export async function fetchCloudFile(link: CloudLink) {
  const res = await fetch(link.url, { redirect: "follow", headers: { "User-Agent": "RealDesigns/1.0" } });
  if (!res.ok) {
    return { ok: false as const, message: `Could not download (${res.status}) — check that the link is set to “Anyone with the link”` };
  }
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!OK_TYPES.includes(type)) {
    return { ok: false as const, message: type.startsWith("text/") ? "Link is not shared publicly, or is not a photo" : `Unsupported file type${type ? ` (${type})` : ""}` };
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return { ok: false as const, message: "File is larger than 15 MB" };

  const disp = res.headers.get("content-disposition") || "";
  const nm = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disp)?.[1];
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("heic") || type.includes("heif") ? "heic" : "jpg";
  let name = (nm ? decodeURIComponent(nm) : link.name).replace(/[\\/]/g, "-").slice(0, 120);
  if (!/\.[a-z0-9]{3,4}$/i.test(name)) name = `${name}.${ext}`;

  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { ok: true as const, name, type, size: buf.byteLength, data: btoa(bin) };
}
