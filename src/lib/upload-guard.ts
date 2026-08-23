/**
 * REAL DESIGNS — file-content validation, shared by client and server.
 *
 * Filename extensions and the browser-declared MIME type are both attacker
 * controlled, so neither decides anything on its own: the byte signature is
 * the authority, and the declared type must agree with it.
 *
 * Pure functions only (no DOM, no Supabase) so the server can run the exact
 * same checks the client ran.
 */

export type DetectedKind =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp"
  | "image/avif"
  | "image/heic"
  | "image/bmp"
  | "image/svg+xml"
  | "video/mp4"
  | "video/webm"
  | "video/quicktime"
  | "audio/mpeg"
  | "audio/wav"
  | "application/pdf"
  | "application/zip"
  | "application/x-executable"
  | "unknown";

const ascii = (b: Uint8Array, at: number, len: number) =>
  String.fromCharCode(...Array.from(b.slice(at, at + len)));

/** Identify a file from its leading bytes. Never trusts name or declared type. */
export function detectFileKind(bytes: Uint8Array): DetectedKind {
  const b = bytes;
  if (b.length < 4) return "unknown";
  const hex4 = Array.from(b.slice(0, 4))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");

  if (hex4.startsWith("ffd8ff")) return "image/jpeg";
  if (hex4 === "89504e47") return "image/png";
  if (ascii(b, 0, 3) === "GIF") return "image/gif";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") return "audio/wav";
  if (ascii(b, 0, 2) === "BM") return "image/bmp";
  if (hex4 === "25504446") return "application/pdf"; // %PDF
  if (hex4 === "504b0304" || hex4 === "504b0506") return "application/zip";
  if (hex4 === "7f454c46") return "application/x-executable"; // ELF
  if (ascii(b, 0, 2) === "MZ") return "application/x-executable"; // PE/EXE
  if (hex4 === "cafebabe" || hex4 === "feedface" || hex4 === "cffaedfe")
    return "application/x-executable"; // Mach-O / class
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  if (b[0] === 0xff && (b[1] === 0xfb || b[1] === 0xf3 || b[1] === 0xf2)) return "audio/mpeg";
  if (ascii(b, 0, 3) === "ID3") return "audio/mpeg";

  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4).toLowerCase();
    if (brand.startsWith("heic") || brand.startsWith("heix") || brand.startsWith("hevc"))
      return "image/heic";
    if (brand === "mif1" || brand === "msf1") return "image/heic";
    if (brand.startsWith("avif") || brand === "avis") return "image/avif";
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }

  // SVG and other XML are text; sniff only the first bytes, case-insensitively.
  const head = ascii(b, 0, Math.min(512, b.length)).toLowerCase().trimStart();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg")))
    return "image/svg+xml";

  return "unknown";
}

export const RASTER_IMAGE_KINDS: DetectedKind[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/bmp",
];

/** Read intrinsic dimensions from the header bytes of common raster formats. */
export function readImageDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const kind = detectFileKind(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (kind === "image/png" && bytes.length > 24) {
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (kind === "image/gif" && bytes.length > 10) {
      return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    }
    if (kind === "image/bmp" && bytes.length > 26) {
      return { width: view.getInt32(18, true), height: Math.abs(view.getInt32(22, true)) };
    }
    if (kind === "image/webp" && bytes.length > 30) {
      const chunk = ascii(bytes, 12, 4);
      if (chunk === "VP8X")
        return {
          width: 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)),
          height: 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)),
        };
      if (chunk === "VP8 ")
        return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
      if (chunk === "VP8L") {
        const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      return null;
    }
    if (kind === "image/jpeg") {
      let i = 2;
      while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = bytes[i + 1]!;
        const len = view.getUint16(i + 2);
        // SOF0..SOF15 except DHT(c4)/JPG(c8)/DAC(cc) carry the frame size.
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { width: view.getUint16(i + 7), height: view.getUint16(i + 5) };
        }
        if (len <= 0) break;
        i += 2 + len;
      }
      return null;
    }
  } catch {
    return null;
  }
  return null;
}

export type UploadRules = {
  /** Signatures that may be stored, after sniffing. */
  allowKinds: DetectedKind[];
  maxBytes: number;
  maxPixels?: number;
  maxDimension?: number;
  label: string;
};

export const UPLOAD_RULES: Record<string, UploadRules> = {
  "room-photos": {
    allowKinds: RASTER_IMAGE_KINDS,
    maxBytes: 15 * 1024 * 1024,
    // ~100 MP: above this a decode is a memory-exhaustion vector, not a photo.
    maxPixels: 100_000_000,
    maxDimension: 20_000,
    label: "Photos must be a JPEG, PNG, WEBP, AVIF, HEIC, GIF or BMP image under 15 MB.",
  },
  "reveal-videos": {
    allowKinds: ["video/mp4", "video/webm", "video/quicktime"],
    maxBytes: 200 * 1024 * 1024,
    label: "Videos must be an MP4, WEBM or MOV file under 200 MB.",
  },
  "user-audio": {
    allowKinds: ["audio/mpeg", "audio/wav", "video/mp4"],
    maxBytes: 25 * 1024 * 1024,
    label: "Audio must be an MP3, WAV or M4A file under 25 MB.",
  },
  "brand-assets": {
    allowKinds: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    maxBytes: 5 * 1024 * 1024,
    maxPixels: 40_000_000,
    maxDimension: 8_000,
    label: "Logos must be a JPEG, PNG, WEBP or AVIF image under 5 MB.",
  },
};

export type UploadVerdict =
  | { ok: true; kind: DetectedKind; width: number | null; height: number | null }
  | {
      ok: false;
      code:
        | "unknown_bucket"
        | "too_large"
        | "empty"
        | "unsupported_type"
        | "declared_type_mismatch"
        | "svg_rejected"
        | "executable_rejected"
        | "dimensions_too_large";
      message: string;
    };

/**
 * The authoritative check. `declaredType` is compared to the sniffed type but
 * never substitutes for it; the extension is not consulted at all.
 */
export function validateUploadBytes(
  bucket: string,
  bytes: Uint8Array,
  declaredType?: string | null,
): UploadVerdict {
  const rules = UPLOAD_RULES[bucket];
  if (!rules)
    return { ok: false, code: "unknown_bucket", message: "That upload destination is not allowed." };
  if (bytes.byteLength === 0) return { ok: false, code: "empty", message: "That file is empty." };
  if (bytes.byteLength > rules.maxBytes)
    return { ok: false, code: "too_large", message: rules.label };

  const kind = detectFileKind(bytes);
  if (kind === "application/x-executable")
    return {
      ok: false,
      code: "executable_rejected",
      message: "That file is a program, not a media file.",
    };
  // SVG is script-capable markup. REAL DESIGNS never needs it, so it is
  // rejected outright rather than sanitized — no sanitizer is a place to bet
  // the whole origin on.
  if (kind === "image/svg+xml")
    return {
      ok: false,
      code: "svg_rejected",
      message: "SVG files are not supported. Upload a JPEG, PNG or WEBP instead.",
    };
  if (!rules.allowKinds.includes(kind))
    return { ok: false, code: "unsupported_type", message: rules.label };

  const declared = String(declaredType || "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  if (declared && !typesAgree(declared, kind))
    return {
      ok: false,
      code: "declared_type_mismatch",
      message: "That file's contents do not match its type.",
    };

  const dims = readImageDimensions(bytes);
  if (dims) {
    const px = dims.width * dims.height;
    if (
      (rules.maxDimension && Math.max(dims.width, dims.height) > rules.maxDimension) ||
      (rules.maxPixels && px > rules.maxPixels)
    ) {
      return {
        ok: false,
        code: "dimensions_too_large",
        message: "That image's dimensions are too large to process.",
      };
    }
  }

  return { ok: true, kind, width: dims?.width ?? null, height: dims?.height ?? null };
}

/** Declared type only has to agree at family level; browsers vary on subtypes. */
function typesAgree(declared: string, kind: DetectedKind): boolean {
  if (declared === kind) return true;
  const aliases: Record<string, DetectedKind[]> = {
    "image/jpg": ["image/jpeg"],
    "image/heif": ["image/heic"],
    "image/heic-sequence": ["image/heic"],
    "video/mov": ["video/quicktime"],
    "video/x-m4v": ["video/mp4"],
    "audio/mp3": ["audio/mpeg"],
    "audio/x-wav": ["audio/wav"],
    "audio/wave": ["audio/wav"],
    "audio/mp4": ["video/mp4", "audio/mpeg"],
    "audio/x-m4a": ["video/mp4"],
    "audio/m4a": ["video/mp4"],
    "video/mp4": ["video/mp4", "image/avif", "image/heic"],
  };
  if (aliases[declared]?.includes(kind)) return true;
  // HEIC/AVIF/MP4 share the ISO-BMFF container; accept cross-labelling there.
  const isoBmff: DetectedKind[] = ["image/heic", "image/avif", "video/mp4", "video/quicktime"];
  if (isoBmff.includes(kind) && isoBmff.includes(declared as DetectedKind)) return true;
  return false;
}

/** True when a storage path is inside the given user's own folder. */
export function isSafeStoragePath(path: string, userId: string): boolean {
  if (!path || !userId) return false;
  if (path.includes("..") || path.startsWith("/") || path.includes("\\")) return false;
  // eslint-disable-next-line no-control-regex -- control characters are never valid in a key
  if (/[\u0000-\u001f\u007f]/.test(path)) return false;
  if (!/^[A-Za-z0-9._\-/]+$/.test(path)) return false;
  return path.startsWith(`${userId}/`);
}
