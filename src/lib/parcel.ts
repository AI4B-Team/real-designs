/**
 * REAL DESIGNS — Parcel boundary overlay.
 *
 * A parcel overlay is a polygon supplied by a configured parcel/GIS provider,
 * drawn over a photograph. Two truths govern every function here:
 *
 *  1. Geometry only ever comes from a real provider response. Nothing in this
 *     module invents, traces or image-recognises a boundary. A failed lookup
 *     produces an error, never a shape.
 *  2. Even official geometry becomes approximate the moment it is placed over a
 *     photograph, because the alignment is a visual fit. The overlay is never
 *     described as a verified boundary, a survey or a title determination.
 */

import type { Point } from "@/lib/markup";

/* ------------------------------------------------------------------ model */

export type LngLat = { lng: number; lat: number };

export type ParcelGeometry = {
  /** Outer ring, in provider order. Holes are not overlaid. */
  ring: LngLat[];
};

export type ParcelRecord = {
  parcelId: string;
  address: string;
  geometry: ParcelGeometry;
  /** Who supplied it. Always a configured provider, never "estimated". */
  provider: string;
  /** ISO timestamp of the provider retrieval. */
  retrievedAt: string;
  /** County/jurisdiction the provider attributes the record to. */
  jurisdiction?: string | null;
  /** Licensing note returned with the data; controls what may be stored. */
  license?: string | null;
};

/** Geospatial information the source image carries, if any. */
export type ImageGeoreference =
  | { kind: "none" }
  | {
      kind: "tile_bounds" | "map_bounds";
      bounds: { north: number; south: number; east: number; west: number };
      /** Map rotation in degrees, when the provider supplies one. */
      rotation?: number;
      provider?: string | null;
    }
  | { kind: "gps"; center: LngLat; metersPerPixel: number; heading?: number };

/** Where the overlay sits on the frame. All values are normalized/relative. */
export type ParcelAlignment = {
  /** Translation in normalized frame units. */
  tx: number;
  ty: number;
  scale: number;
  /** Degrees, clockwise. */
  rotation: number;
  /** Per-corner nudges of the fitted bounding box, normalized. */
  corners: { tl: Point; tr: Point; br: Point; bl: Point };
  opacity: number;
};

export type ParcelConfidence = "georeferenced" | "manual" | "unaligned";

export type ParcelOverlay = {
  record: ParcelRecord;
  georeference: ImageGeoreference;
  alignment: ParcelAlignment;
  /** Normalized polygon actually drawn, derived from record + alignment. */
  points: Point[];
  confidence: ParcelConfidence;
  /** The user ticked the approximation warning during import. */
  warningAccepted: boolean;
  /** Set once the user presses Confirm Alignment. */
  alignedAt?: string | null;
};

/* ---------------------------------------------------------------- warning */

/** The exact legal copy. Every surface uses this string verbatim. */
export const PARCEL_WARNING =
  "Approximate visual overlay only. Parcel data and image alignment may be inaccurate. This is not a survey, title determination or legal boundary.";

/** Short badge for the on-image disclosure. */
export const PARCEL_DISCLOSURE_TEXT = "Approximate Parcel Overlay — Not A Survey";

/** Language that must never describe a visually placed polygon. */
export const FORBIDDEN_PARCEL_TERMS = [
  "verified boundary",
  "survey",
  "surveyed",
  "legal boundary",
  "title determination",
];

/**
 * Guard for any user-facing string this feature produces. It exists so a future
 * copy change cannot quietly reintroduce "Verified Boundary" into a label.
 */
export function describesAsSurvey(text: string): boolean {
  const t = (text || "").toLowerCase();
  /* The warning itself names those words in order to deny them. */
  if (t.includes(PARCEL_WARNING.toLowerCase())) return false;
  return FORBIDDEN_PARCEL_TERMS.some((term) => t.includes(term));
}

export function confidenceLabel(c: ParcelConfidence): string {
  if (c === "georeferenced") return "Provider Georeferenced Placement (Approximate)";
  if (c === "manual") return "Manually Aligned By You (Approximate)";
  return "Not Yet Aligned";
}

/* -------------------------------------------------------------- validation */

export type ParcelValidation =
  | { ok: true; record: ParcelRecord }
  | { ok: false; error: string };

const isLng = (v: any) => Number.isFinite(v) && v >= -180 && v <= 180;
const isLat = (v: any) => Number.isFinite(v) && v >= -90 && v <= 90;

/**
 * Accept a provider response, or refuse it. There is no partial acceptance and
 * no repair: a response missing its parcel id, its provider, its timestamp or a
 * usable ring is discarded, and the caller shows the failure.
 */
export function validateParcelResponse(raw: any): ParcelValidation {
  if (!raw || typeof raw !== "object") return { ok: false, error: "The Provider Returned No Data." };
  const provider = String(raw.provider || "").trim();
  if (!provider) return { ok: false, error: "The Response Names No Data Provider." };
  const parcelId = String(raw.parcelId ?? raw.parcel_id ?? "").trim();
  if (!parcelId) return { ok: false, error: "The Response Carries No Parcel ID." };
  const retrievedAt = String(raw.retrievedAt ?? raw.retrieved_at ?? "").trim();
  if (!retrievedAt || Number.isNaN(Date.parse(retrievedAt))) {
    return { ok: false, error: "The Response Carries No Retrieval Timestamp." };
  }
  const rawRing = raw.geometry?.ring ?? raw.geometry?.coordinates?.[0] ?? raw.ring;
  if (!Array.isArray(rawRing) || rawRing.length < 3) {
    return { ok: false, error: "The Response Contains No Parcel Boundary Geometry." };
  }
  const ring: LngLat[] = [];
  for (const p of rawRing) {
    const lng = Array.isArray(p) ? p[0] : p?.lng ?? p?.longitude;
    const lat = Array.isArray(p) ? p[1] : p?.lat ?? p?.latitude;
    if (!isLng(lng) || !isLat(lat)) {
      return { ok: false, error: "The Parcel Geometry Contains Invalid Coordinates." };
    }
    ring.push({ lng: Number(lng), lat: Number(lat) });
  }
  const address = String(raw.address || "").trim();
  if (!address) return { ok: false, error: "The Response Carries No Property Address." };
  return {
    ok: true,
    record: {
      parcelId,
      address,
      geometry: { ring },
      provider,
      retrievedAt,
      jurisdiction: raw.jurisdiction ?? null,
      license: raw.license ?? null,
    },
  };
}

/* ------------------------------------------------------------- projection */

export function defaultAlignment(): ParcelAlignment {
  return {
    tx: 0,
    ty: 0,
    scale: 1,
    rotation: 0,
    corners: { tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } },
    opacity: 0.55,
  };
}

/** Only these sources justify placing the polygon without asking the user. */
export function canAutoAlign(geo: ImageGeoreference | null | undefined): boolean {
  if (!geo) return false;
  if (geo.kind === "tile_bounds" || geo.kind === "map_bounds") {
    const b = geo.bounds;
    return (
      isLat(b?.north) && isLat(b?.south) && isLng(b?.east) && isLng(b?.west) && b.north > b.south
    );
  }
  if (geo.kind === "gps") return isLng(geo.center?.lng) && isLat(geo.center?.lat) && geo.metersPerPixel > 0;
  return false;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0);

/**
 * Place the ring inside known map bounds. This is the only automatic placement
 * path, and it exists only when the image itself states what ground it covers.
 */
export function projectToBounds(
  ring: LngLat[],
  bounds: { north: number; south: number; east: number; west: number },
): Point[] {
  const w = bounds.east - bounds.west || 1;
  const h = bounds.north - bounds.south || 1;
  return ring.map((p) => ({
    x: clamp01((p.lng - bounds.west) / w),
    y: clamp01((bounds.north - p.lat) / h),
  }));
}

/**
 * Fit the ring into a neutral box in the middle of the frame. Used when the
 * image cannot be georeferenced: the shape is true, its position is not, and
 * the caller must open alignment mode.
 */
export function fitToFrame(ring: LngLat[], box = 0.5): Point[] {
  const lngs = ring.map((p) => p.lng);
  const lats = ring.map((p) => p.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const w = maxLng - minLng || 1e-6;
  /* Latitude degrees are longer than longitude degrees away from the equator. */
  const midLat = (maxLat + minLat) / 2;
  const h = (maxLat - minLat || 1e-6) / Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  const span = Math.max(w, h);
  const sx = (box * w) / span;
  const sy = (box * h) / span;
  return ring.map((p) => ({
    x: clamp01(0.5 - sx / 2 + ((p.lng - minLng) / w) * sx),
    y: clamp01(0.5 - sy / 2 + ((maxLat - p.lat) / (maxLat - minLat || 1e-6)) * sy),
  }));
}

/* -------------------------------------------------------------- alignment */

function centroidOf(points: Point[]): Point {
  const n = points.length || 1;
  return {
    x: points.reduce((a, p) => a + p.x, 0) / n,
    y: points.reduce((a, p) => a + p.y, 0) / n,
  };
}

/**
 * Apply move, rotate, scale and per-corner adjustment to the projected shape.
 * The base points are never mutated, so Reset Alignment always returns exactly
 * to the provider geometry as first projected.
 */
export function applyAlignment(base: Point[], a: ParcelAlignment): Point[] {
  if (!base.length) return [];
  const c = centroidOf(base);
  const rad = (a.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const moved = base.map((p) => {
    const dx = (p.x - c.x) * a.scale;
    const dy = (p.y - c.y) * a.scale;
    return { x: c.x + dx * cos - dy * sin + a.tx, y: c.y + dx * sin + dy * cos + a.ty };
  });
  /* Corner adjustment: bilinear warp of the shape's own bounding box. */
  const xs = moved.map((p) => p.x);
  const ys = moved.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX || 1e-6;
  const h = maxY - minY || 1e-6;
  const { tl, tr, br, bl } = a.corners;
  return moved.map((p) => {
    const u = (p.x - minX) / w;
    const v = (p.y - minY) / h;
    const ox = (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x;
    const oy = (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y;
    return { x: clamp01(p.x + ox), y: clamp01(p.y + oy) };
  });
}

export function nudgeAlignment(a: ParcelAlignment, dx: number, dy: number): ParcelAlignment {
  return { ...a, tx: a.tx + dx, ty: a.ty + dy };
}

export function rotateAlignment(a: ParcelAlignment, deg: number): ParcelAlignment {
  return { ...a, rotation: ((a.rotation + deg) % 360 + 360) % 360 };
}

export function scaleAlignment(a: ParcelAlignment, factor: number): ParcelAlignment {
  return { ...a, scale: Math.max(0.05, Math.min(8, a.scale * factor)) };
}

export function setCorner(
  a: ParcelAlignment,
  corner: keyof ParcelAlignment["corners"],
  offset: Point,
): ParcelAlignment {
  return { ...a, corners: { ...a.corners, [corner]: offset } };
}

export function resetAlignment(a: ParcelAlignment): ParcelAlignment {
  return { ...defaultAlignment(), opacity: a.opacity };
}

/** Was the overlay actually moved by hand? Drives the confidence state. */
export function alignmentTouched(a: ParcelAlignment): boolean {
  const c = a.corners;
  const cornerMoved = [c.tl, c.tr, c.br, c.bl].some((p) => p.x !== 0 || p.y !== 0);
  return a.tx !== 0 || a.ty !== 0 || a.rotation !== 0 || a.scale !== 1 || cornerMoved;
}

/* ---------------------------------------------------------------- overlay */

/**
 * Build the overlay from a validated record. Auto-placement happens only when
 * the image is genuinely georeferenced; otherwise the shape lands in the middle
 * of the frame in alignment mode and says so.
 */
export function buildOverlay(
  record: ParcelRecord,
  georeference: ImageGeoreference,
  opts: { warningAccepted?: boolean } = {},
): ParcelOverlay {
  const auto = canAutoAlign(georeference);
  const base =
    auto && (georeference.kind === "tile_bounds" || georeference.kind === "map_bounds")
      ? projectToBounds(record.geometry.ring, georeference.bounds)
      : fitToFrame(record.geometry.ring);
  const alignment = defaultAlignment();
  return {
    record,
    georeference,
    alignment,
    points: applyAlignment(base, alignment),
    confidence: auto ? "georeferenced" : "unaligned",
    warningAccepted: !!opts.warningAccepted,
    alignedAt: null,
  };
}

/** Recompute the drawn points after an alignment change. */
export function reproject(overlay: ParcelOverlay, alignment: ParcelAlignment): ParcelOverlay {
  const auto = canAutoAlign(overlay.georeference);
  const base =
    auto &&
    (overlay.georeference.kind === "tile_bounds" || overlay.georeference.kind === "map_bounds")
      ? projectToBounds(overlay.record.geometry.ring, overlay.georeference.bounds)
      : fitToFrame(overlay.record.geometry.ring);
  const touched = alignmentTouched(alignment);
  return {
    ...overlay,
    alignment,
    points: applyAlignment(base, alignment),
    confidence: touched ? "manual" : auto ? "georeferenced" : "unaligned",
  };
}

export function confirmAlignment(overlay: ParcelOverlay): ParcelOverlay {
  return {
    ...overlay,
    alignedAt: new Date().toISOString(),
    confidence: alignmentTouched(overlay.alignment)
      ? "manual"
      : canAutoAlign(overlay.georeference)
        ? "georeferenced"
        : "manual",
  };
}

/** Manual alignment is mandatory when the picture cannot be georeferenced. */
export function requiresManualAlignment(overlay: ParcelOverlay): boolean {
  return !canAutoAlign(overlay.georeference) && !overlay.alignedAt;
}

/* ------------------------------------------------------------ audit trail */

export type ParcelAuditEvent = {
  at: string;
  action: "import" | "align" | "confirm" | "reset" | "warning_accepted" | "export" | "remove";
  detail?: Record<string, any>;
};

export function auditEvent(
  action: ParcelAuditEvent["action"],
  detail: Record<string, any> = {},
): ParcelAuditEvent {
  return { at: new Date().toISOString(), action, detail };
}

/**
 * The provenance block stored with the markup and written into exports. It
 * records where the geometry came from, what was done to it and that the
 * warning was shown — never a claim of accuracy.
 */
export function parcelProvenance(overlay: ParcelOverlay, events: ParcelAuditEvent[] = []) {
  return {
    parcel_id: overlay.record.parcelId,
    address: overlay.record.address,
    data_provider: overlay.record.provider,
    jurisdiction: overlay.record.jurisdiction ?? null,
    retrieved_at: overlay.record.retrievedAt,
    license: overlay.record.license ?? null,
    georeference: overlay.georeference.kind,
    alignment: { ...overlay.alignment },
    alignment_confidence: overlay.confidence,
    aligned_at: overlay.alignedAt ?? null,
    warning: PARCEL_WARNING,
    warning_accepted: overlay.warningAccepted,
    is_survey: false as const,
    audit: events,
  };
}
