/**
 * REAL DESIGNS — Property Markup model.
 *
 * Markup is a vector layer drawn ON TOP of a photograph: boundaries, parking,
 * access paths, proposed additions, callouts. It never touches the source
 * pixels. The photograph keeps its clean master, the markup lives beside it as
 * structured, reopenable metadata, and only an export flattens the two.
 *
 * Every coordinate in this module is normalized to the source frame (0..1 on
 * both axes), so a layer drawn on a 900px preview lands in exactly the same
 * place on a 4000px export, at any Canvas zoom.
 *
 * Nothing here is a survey. The warning copy in `MARKUP_WARNING` is part of the
 * model, not a decoration a screen may choose to skip.
 */

import type { CalloutKind, CalloutMeta } from "@/lib/markup-callouts";
import type { ScaleCalibration } from "@/lib/markup-measure";
import type { ParcelAuditEvent, ParcelOverlay } from "@/lib/parcel";
import { PARCEL_WARNING, parcelProvenance } from "@/lib/parcel";
import { measureShape, scaleMetadata } from "@/lib/markup-measure";

/* ------------------------------------------------------------------ model */

export type MarkupTypeId =
  | "boundary"
  | "parking"
  | "footprint"
  | "addition"
  | "access"
  | "driveway"
  | "amenity"
  | "landscape"
  | "measurement"
  | "custom_area"
  | "line"
  | "arrow"
  | "label"
  | "marker"
  /* Advanced markup. */
  | "distance"
  | "area_label"
  | "callout"
  | "renovation"
  | "product"
  | "material"
  | "before_after"
  | "work_zone"
  | "scope_ref";

/** How a type is drawn. Geometry, not vocabulary. */
export type MarkupShape = "polygon" | "line" | "arrow" | "label" | "marker";

export type Point = { x: number; y: number };

export type DashStyle = "solid" | "dashed" | "dotted";
export type ArrowHead = "none" | "end" | "both";
export type LabelPos = "center" | "top" | "bottom" | "start" | "end";

export type MarkupStyle = {
  stroke: string;
  strokeWidth: number;
  dash: DashStyle;
  fill: string;
  fillOpacity: number;
  labelBg: string;
  labelColor: string;
  labelPos: LabelPos;
  labelBackground: boolean;
  arrowHead: ArrowHead;
  fontSize: number;
};

export type MarkupLayer = {
  id: string;
  type: MarkupTypeId;
  shape: MarkupShape;
  /** Layer-list name. Defaults to the type label, renameable. */
  name: string;
  /** Normalized geometry. One point for label/marker, two+ for the rest. */
  points: Point[];
  closed: boolean;
  label: string;
  description?: string;
  /** Numbered markers carry their own number so re-ordering never renumbers. */
  number?: number;
  /** Drag-to-position offset for the label, normalized. */
  labelOffset?: Point | null;
  style: MarkupStyle;
  visible: boolean;
  locked: boolean;
  /** Structured payload for renovation, product, material and scope callouts. */
  meta?: CalloutMeta | null;
  /** Last calculated measurement text, kept for exports and reports. */
  measurementText?: string | null;
};

export type MarkupDoc = {
  version: 1;
  /** Source asset the markup belongs to. */
  assetId: string;
  /** Version of that asset the markup was drawn on, when known. */
  sourceVersionId?: string | null;
  layers: MarkupLayer[];
  /** Burn "Approximate Boundary" into exports as a visible disclosure. */
  visibleDisclosure: boolean;
  /** Scale calibration. Without it, no measurement is ever produced. */
  scale?: ScaleCalibration | null;
  /** Optional provider-supplied parcel overlay. Never image-recognised. */
  parcel?: ParcelOverlay | null;
  /** Provenance trail for the parcel overlay and its exports. */
  parcelAudit?: ParcelAuditEvent[];
};

/* ------------------------------------------------------------------ types */

export type MarkupTypeSpec = {
  id: MarkupTypeId;
  label: string;
  shape: MarkupShape;
  icon: string;
  color: string;
  /** Needs the survey warning: boundaries, easements and measurements. */
  warns: boolean;
  /** Suggested default label text. */
  suggestion?: string;
};

export const MARKUP_TYPES: MarkupTypeSpec[] = [
  { id: "boundary", label: "Property Boundary", shape: "polygon", icon: "land-plot", color: "#CC0000", warns: true, suggestion: "Parcel 1" },
  { id: "parking", label: "Parking Area", shape: "polygon", icon: "square-parking", color: "#2563EB", warns: false, suggestion: "Parking" },
  { id: "footprint", label: "Building Footprint", shape: "polygon", icon: "home", color: "#0F766E", warns: false, suggestion: "Unit A" },
  { id: "addition", label: "Proposed Addition", shape: "polygon", icon: "square-plus", color: "#7C3AED", warns: false, suggestion: "New Addition" },
  { id: "access", label: "Access / Easement", shape: "polygon", icon: "route", color: "#B45309", warns: true, suggestion: "Shared Driveway" },
  { id: "driveway", label: "Driveway", shape: "polygon", icon: "car-front", color: "#475569", warns: false, suggestion: "Driveway" },
  { id: "amenity", label: "Amenity", shape: "polygon", icon: "waves", color: "#0891B2", warns: false, suggestion: "Proposed Pool" },
  { id: "landscape", label: "Landscape Zone", shape: "polygon", icon: "trees", color: "#15803D", warns: false, suggestion: "Landscape" },
  { id: "measurement", label: "Measurement", shape: "line", icon: "ruler", color: "#CC0000", warns: true, suggestion: "Approx. Distance" },
  { id: "custom_area", label: "Custom Area", shape: "polygon", icon: "pentagon", color: "#334155", warns: false, suggestion: "Custom Area" },
  { id: "line", label: "Line", shape: "line", icon: "minus", color: "#111827", warns: false },
  { id: "arrow", label: "Arrow", shape: "arrow", icon: "move-up-right", color: "#CC0000", warns: false },
  { id: "label", label: "Label", shape: "label", icon: "type", color: "#111827", warns: false, suggestion: "Custom text" },
  { id: "marker", label: "Numbered Marker", shape: "marker", icon: "circle-dot", color: "#CC0000", warns: false },
  /* Advanced markup. Each one stays structured and editable: the drawn label
     is only a rendering of the record kept on the layer. */
  { id: "distance", label: "Distance Line", shape: "line", icon: "ruler", color: "#CC0000", warns: true, suggestion: "Approximate Distance" },
  { id: "area_label", label: "Area Label", shape: "label", icon: "scan", color: "#0F766E", warns: true, suggestion: "Approximate Area" },
  { id: "callout", label: "Measurement Callout", shape: "arrow", icon: "ruler-dimension-line", color: "#CC0000", warns: true, suggestion: "Approximate" },
  { id: "renovation", label: "Renovation Note", shape: "marker", icon: "hammer", color: "#B45309", warns: false },
  { id: "product", label: "Product Callout", shape: "marker", icon: "shopping-bag", color: "#7C3AED", warns: false },
  { id: "material", label: "Material Callout", shape: "marker", icon: "layers", color: "#0891B2", warns: false },
  { id: "before_after", label: "Before / After Note", shape: "label", icon: "arrow-left-right", color: "#111827", warns: false, suggestion: "Before / After" },
  { id: "work_zone", label: "Proposed Work Zone", shape: "polygon", icon: "construction", color: "#EA580C", warns: false, suggestion: "Proposed Work" },
  { id: "scope_ref", label: "Contractor Scope Reference", shape: "marker", icon: "clipboard-list", color: "#334155", warns: false },
];

/** Advanced markup that carries a structured record rather than plain text. */
export const CALLOUT_TYPES: Partial<Record<MarkupTypeId, CalloutKind>> = {
  renovation: "renovation",
  product: "product",
  material: "material",
  before_after: "before_after",
  scope_ref: "scope",
};

/** Markup whose label is a calculated measurement. */
export const MEASURED_TYPES: MarkupTypeId[] = ["distance", "area_label", "callout", "measurement"];

export function markupType(id: MarkupTypeId): MarkupTypeSpec {
  return MARKUP_TYPES.find((t) => t.id === id) || (MARKUP_TYPES[MARKUP_TYPES.length - 1] as MarkupTypeSpec);
}

/** The label suggestions the panel offers, in the order the spec lists them. */
export const LABEL_SUGGESTIONS = [
  "Parking",
  "Unit A",
  "Proposed Pool",
  "New Addition",
  "Shared Driveway",
  "Parcel 1",
  "Parcel 2",
];

/** Accessible presets: each reads against both light and dark photographs. */
export const MARKUP_COLORS = [
  "#CC0000",
  "#B45309",
  "#15803D",
  "#0891B2",
  "#2563EB",
  "#7C3AED",
  "#111827",
  "#FFFFFF",
];

/* ---------------------------------------------------------------- warning */

export const MARKUP_WARNING =
  "Visual reference only. Not a survey or legal boundary. Verify using official records and a licensed surveyor where required.";

/** The optional visible on-image disclosure. */
export const MARKUP_DISCLOSURE_TEXT = "Approximate Boundary";

/** A manually drawn line is never a verified boundary — this decides the copy. */
export function warningRequired(layers: MarkupLayer[], visibleOnly = true): boolean {
  return layers.some((l) => (!visibleOnly || l.visible) && markupType(l.type).warns);
}

/** Markup is vector work in the browser: it never spends a design credit. */
export const MARKUP_CREDITS = 0;

/* --------------------------------------------------------------- creation */

let seq = 0;
function uid(): string {
  seq += 1;
  const rnd = Math.random().toString(36).slice(2, 8);
  return `mk_${Date.now().toString(36)}_${seq}_${rnd}`;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0;
}

export function clampPoint(p: Point): Point {
  return { x: clamp01(p.x), y: clamp01(p.y) };
}

export function defaultStyle(type: MarkupTypeId): MarkupStyle {
  const spec = markupType(type);
  return {
    stroke: spec.color,
    strokeWidth: spec.shape === "polygon" ? 3 : 4,
    dash: type === "access" || type === "boundary" ? "dashed" : "solid",
    fill: spec.color,
    fillOpacity: spec.shape === "polygon" ? 0.18 : 0,
    labelBg: "#111111",
    labelColor: "#FFFFFF",
    labelPos: "center",
    labelBackground: true,
    arrowHead: spec.shape === "arrow" ? "end" : "none",
    fontSize: 16,
  };
}

export function createLayer(
  type: MarkupTypeId,
  points: Point[] = [],
  extra: Partial<MarkupLayer> = {},
): MarkupLayer {
  const spec = markupType(type);
  return {
    id: uid(),
    type,
    shape: spec.shape,
    name: spec.label,
    points: points.map(clampPoint),
    closed: spec.shape === "polygon" ? points.length > 2 : false,
    label: extra.label ?? (spec.shape === "marker" ? "" : spec.suggestion || ""),
    labelOffset: null,
    style: defaultStyle(type),
    visible: true,
    locked: false,
    ...extra,
  };
}

/** Markers number themselves in the order they were placed. */
export function nextMarkerNumber(layers: MarkupLayer[]): number {
  const used = layers.filter((l) => l.shape === "marker").map((l) => l.number || 0);
  return (used.length ? Math.max(...used) : 0) + 1;
}

export function emptyDoc(assetId: string, sourceVersionId: string | null = null): MarkupDoc {
  return {
    version: 1,
    assetId,
    sourceVersionId,
    layers: [],
    visibleDisclosure: false,
    scale: null,
    parcel: null,
    parcelAudit: [],
  };
}

/* ------------------------------------------------------------- drawing ops */

/** Minimum points before a shape is worth keeping. */
export function minPoints(shape: MarkupShape): number {
  return shape === "polygon" ? 3 : shape === "label" || shape === "marker" ? 1 : 2;
}

/**
 * Does this click land on the first point? That is the canonical way to close
 * a polygon; Enter and double-click are shortcuts for the same thing.
 */
export function closesOnFirstPoint(points: Point[], at: Point, tolerance = 0.02): boolean {
  const first = points[0];
  if (!first || points.length < 3) return false;
  return Math.hypot(first.x - at.x, first.y - at.y) <= tolerance;
}

/** Close a drafted polygon, or refuse when it has too few points. */
export function closePolygon(points: Point[]): { ok: boolean; points: Point[] } {
  if (points.length < 3) return { ok: false, points };
  return { ok: true, points: points.map(clampPoint) };
}

export function movePoint(layer: MarkupLayer, index: number, to: Point): MarkupLayer {
  if (layer.locked || index < 0 || index >= layer.points.length) return layer;
  const points = layer.points.slice();
  points[index] = clampPoint(to);
  return { ...layer, points };
}

/** Insert a point between `index` and the next one — the midpoint by default. */
export function insertPoint(layer: MarkupLayer, index: number, at?: Point): MarkupLayer {
  if (layer.locked) return layer;
  const a = layer.points[index];
  const b = layer.points[(index + 1) % layer.points.length];
  if (!a || !b) return layer;
  const p = at ? clampPoint(at) : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const points = layer.points.slice();
  points.splice(index + 1, 0, p);
  return { ...layer, points };
}

export function deletePoint(layer: MarkupLayer, index: number): MarkupLayer {
  if (layer.locked) return layer;
  if (layer.points.length <= minPoints(layer.shape)) return layer;
  const points = layer.points.slice();
  points.splice(index, 1);
  return { ...layer, points };
}

export function moveLayer(layer: MarkupLayer, dx: number, dy: number): MarkupLayer {
  if (layer.locked) return layer;
  /* The whole shape shifts together, and stops at the frame instead of
     letting one vertex silently clip away. */
  const minX = Math.min(...layer.points.map((p) => p.x));
  const maxX = Math.max(...layer.points.map((p) => p.x));
  const minY = Math.min(...layer.points.map((p) => p.y));
  const maxY = Math.max(...layer.points.map((p) => p.y));
  const ddx = Math.max(-minX, Math.min(dx, 1 - maxX));
  const ddy = Math.max(-minY, Math.min(dy, 1 - maxY));
  return { ...layer, points: layer.points.map((p) => clampPoint({ x: p.x + ddx, y: p.y + ddy })) };
}

/* --------------------------------------------------------------- layer ops */

export function duplicateLayer(layers: MarkupLayer[], id: string): MarkupLayer[] {
  const i = layers.findIndex((l) => l.id === id);
  const src = layers[i];
  if (!src) return layers;
  const copy: MarkupLayer = {
    ...src,
    id: uid(),
    name: `${src.name} Copy`,
    locked: false,
    ...(src.shape === "marker"
      ? { number: nextMarkerNumber(layers) }
      : src.number !== undefined
        ? { number: src.number }
        : {}),
    points: src.points.map((p) => clampPoint({ x: p.x + 0.02, y: p.y + 0.02 })),
  };
  const next = layers.slice();
  next.splice(i + 1, 0, copy);
  return next;
}

export function removeLayer(layers: MarkupLayer[], id: string): MarkupLayer[] {
  return layers.filter((l) => l.id !== id);
}

/** Z-order. Later in the array paints later, so "forward" moves toward the end. */
export function bringForward(layers: MarkupLayer[], id: string): MarkupLayer[] {
  const i = layers.findIndex((l) => l.id === id);
  if (i < 0 || i === layers.length - 1) return layers;
  const next = layers.slice();
  const [item] = next.splice(i, 1);
  next.splice(i + 1, 0, item as MarkupLayer);
  return next;
}

export function sendBackward(layers: MarkupLayer[], id: string): MarkupLayer[] {
  const i = layers.findIndex((l) => l.id === id);
  if (i <= 0) return layers;
  const next = layers.slice();
  const [item] = next.splice(i, 1);
  next.splice(i - 1, 0, item as MarkupLayer);
  return next;
}

export function updateLayer(
  layers: MarkupLayer[],
  id: string,
  patch: Partial<MarkupLayer>,
): MarkupLayer[] {
  return layers.map((l) => (l.id === id ? { ...l, ...patch } : l));
}

export function updateStyle(
  layers: MarkupLayer[],
  id: string,
  patch: Partial<MarkupStyle>,
): MarkupLayer[] {
  return layers.map((l) => (l.id === id ? { ...l, style: { ...l.style, ...patch } } : l));
}

/* --------------------------------------------------------------- geometry */

export function toPixels(p: Point, w: number, h: number): { x: number; y: number } {
  return { x: p.x * w, y: p.y * h };
}

export function toNormalized(x: number, y: number, w: number, h: number): Point {
  return clampPoint({ x: w ? x / w : 0, y: h ? y / h : 0 });
}

export function centroid(points: Point[]): Point {
  if (!points.length) return { x: 0.5, y: 0.5 };
  const sx = points.reduce((a, p) => a + p.x, 0);
  const sy = points.reduce((a, p) => a + p.y, 0);
  return { x: sx / points.length, y: sy / points.length };
}

/** Where a layer's label sits before any drag offset. */
export function labelAnchor(layer: MarkupLayer): Point {
  const pts = layer.points;
  const first = pts[0] || { x: 0.5, y: 0.5 };
  const last = pts[pts.length - 1] || first;
  const base = (() => {
    switch (layer.style.labelPos) {
      case "start":
        return first;
      case "end":
        return last;
      case "top": {
        const c = centroid(pts);
        return { x: c.x, y: Math.min(...pts.map((p) => p.y)) };
      }
      case "bottom": {
        const c = centroid(pts);
        return { x: c.x, y: Math.max(...pts.map((p) => p.y)) };
      }
      default:
        return layer.shape === "polygon" ? centroid(pts) : first;
    }
  })();
  const off = layer.labelOffset;
  return clampPoint(off ? { x: base.x + off.x, y: base.y + off.y } : base);
}

/**
 * Keep a label box fully inside the exported frame. A caption that reads
 * perfectly in the editor and then loses half its text at the crop edge is a
 * bug, not a styling choice.
 */
export function clampLabelBox(
  box: { x: number; y: number; w: number; h: number },
  W: number,
  H: number,
  margin = 0,
): { x: number; y: number; w: number; h: number } {
  const w = Math.min(box.w, Math.max(0, W - margin * 2));
  const h = Math.min(box.h, Math.max(0, H - margin * 2));
  const x = Math.max(margin, Math.min(box.x, W - margin - w));
  const y = Math.max(margin, Math.min(box.y, H - margin - h));
  return { x, y, w, h };
}

/** Font size that stays readable at any export resolution. */
export function scaledFontSize(base: number, width: number): number {
  /* `base` is authored against a 1000px-wide frame. */
  return Math.max(11, Math.round((base * width) / 1000));
}

export function scaledStroke(base: number, width: number): number {
  return Math.max(1, (base * width) / 1000);
}

export function dashPattern(dash: DashStyle, width: number): number[] {
  const u = Math.max(2, width / 220);
  if (dash === "dashed") return [u * 4, u * 3];
  if (dash === "dotted") return [u, u * 2.2];
  return [];
}

/* ------------------------------------------------------------- hit testing */

export function pointInPolygon(pts: Point[], p: Point): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    const hit =
      a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = vx * vx + vy * vy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len)) : 0;
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

export type Hit =
  | { kind: "vertex"; layerId: string; index: number }
  | { kind: "edge"; layerId: string; index: number }
  | { kind: "label"; layerId: string }
  | { kind: "body"; layerId: string }
  | null;

/** Topmost interactive thing under the pointer. Locked layers never answer. */
export function hitTest(layers: MarkupLayer[], at: Point, tol = 0.015): Hit {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const l = layers[i]!;
    if (!l.visible || l.locked) continue;
    for (let v = 0; v < l.points.length; v += 1) {
      const p = l.points[v]!;
      if (Math.hypot(p.x - at.x, p.y - at.y) <= tol) return { kind: "vertex", layerId: l.id, index: v };
    }
    if (l.label) {
      const a = labelAnchor(l);
      if (Math.abs(a.x - at.x) <= tol * 3 && Math.abs(a.y - at.y) <= tol * 1.6)
        return { kind: "label", layerId: l.id };
    }
    if (l.shape === "polygon" && l.closed && pointInPolygon(l.points, at))
      return { kind: "body", layerId: l.id };
    for (let s = 0; s < l.points.length - (l.closed ? 0 : 1); s += 1) {
      const a = l.points[s]!;
      const b = l.points[(s + 1) % l.points.length]!;
      if (distanceToSegment(at, a, b) <= tol) return { kind: "edge", layerId: l.id, index: s };
    }
    if ((l.shape === "marker" || l.shape === "label") && l.points[0]) {
      const p = l.points[0]!;
      if (Math.hypot(p.x - at.x, p.y - at.y) <= tol * 2.4) return { kind: "body", layerId: l.id };
    }
  }
  return null;
}

/* ------------------------------------------------------------ serialization */

export function serializeMarkup(doc: MarkupDoc): MarkupDoc {
  return {
    version: 1,
    assetId: doc.assetId,
    sourceVersionId: doc.sourceVersionId ?? null,
    visibleDisclosure: !!doc.visibleDisclosure,
    scale: doc.scale ?? null,
    parcel: doc.parcel ?? null,
    parcelAudit: doc.parcelAudit ?? [],
    layers: doc.layers.map((l) => ({
      ...l,
      points: l.points.map(clampPoint),
      style: { ...l.style },
      meta: l.meta ? { ...l.meta } : null,
      measurementText: l.measurementText ?? null,
    })),
  };
}

/** Read a stored document back. Anything malformed degrades to an empty doc. */
export function parseMarkup(raw: unknown, assetId: string): MarkupDoc {
  const doc = raw as Partial<MarkupDoc> | null;
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.layers)) return emptyDoc(assetId);
  const layers: MarkupLayer[] = [];
  for (const raw of doc.layers as MarkupLayer[]) {
    if (!raw || typeof raw !== "object") continue;
    const spec = MARKUP_TYPES.find((t) => t.id === raw.type);
    if (!spec) continue;
    const points = Array.isArray(raw.points)
      ? raw.points
          .filter((p: any) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
          .map((p: Point) => clampPoint(p))
      : [];
    if (points.length < minPoints(spec.shape)) continue;
    layers.push({
      ...createLayer(spec.id, points),
      ...raw,
      id: raw.id || uid(),
      shape: spec.shape,
      points,
      style: { ...defaultStyle(spec.id), ...(raw.style || {}) },
      visible: raw.visible !== false,
      locked: !!raw.locked,
      closed: spec.shape === "polygon" ? true : !!raw.closed,
    });
  }
  return {
    version: 1,
    assetId: doc.assetId || assetId,
    sourceVersionId: doc.sourceVersionId ?? null,
    visibleDisclosure: !!doc.visibleDisclosure,
    scale: (doc as any).scale ?? null,
    parcel: (doc as any).parcel ?? null,
    parcelAudit: Array.isArray((doc as any).parcelAudit) ? (doc as any).parcelAudit : [],
    layers,
  };
}

/** Layers a viewer or export should draw, in paint order. */
export function visibleLayers(doc: MarkupDoc): MarkupLayer[] {
  return doc.layers.filter((l) => l.visible);
}

export function hasMarkup(doc: MarkupDoc | null | undefined): boolean {
  return !!doc && doc.layers.length > 0;
}

/* ------------------------------------------------------------- disclosure */

/** Markup exports classify as Property Markup in the disclosure system. */
export const MARKUP_CLASSIFICATION = "Property Markup" as const;

/**
 * Export-time metadata. The warning travels with the file, so a downstream
 * viewer can never see the lines without the caveat that produced them.
 */
export function markupMetadata(doc: MarkupDoc) {
  const layers = visibleLayers(doc);
  return {
    op: "property_markup" as const,
    classification: MARKUP_CLASSIFICATION,
    layers: layers.length,
    types: Array.from(new Set(layers.map((l) => l.type))),
    boundary_warning: warningRequired(doc.layers) ? MARKUP_WARNING : null,
    visible_disclosure: doc.visibleDisclosure ? MARKUP_DISCLOSURE_TEXT : null,
    source_version: doc.sourceVersionId ?? null,
    credits: MARKUP_CREDITS,
    scale: scaleMetadata(doc.scale),
    parcel: doc.parcel ? parcelProvenance(doc.parcel, doc.parcelAudit || []) : null,
    parcel_warning: doc.parcel ? PARCEL_WARNING : null,
    callouts: layers
      .filter((l) => !!l.meta)
      .map((l) => ({ id: l.id, type: l.type, meta: l.meta })),
    is_survey: false as const,
  };
}

/* ------------------------------------------------- measurement & callouts */

/**
 * The measurement for one layer, or the reason there is none. A measured layer
 * without calibration returns a message, never a number.
 */
export function layerMeasurement(layer: MarkupLayer, doc: MarkupDoc) {
  if (!MEASURED_TYPES.includes(layer.type)) return null;
  return measureShape(layer.points, layer.closed, doc.scale);
}

/** Refresh the stored measurement text on every measured layer. */
export function refreshMeasurements(doc: MarkupDoc): MarkupDoc {
  return {
    ...doc,
    layers: doc.layers.map((l) => {
      if (!MEASURED_TYPES.includes(l.type)) return l;
      const out = measureShape(l.points, l.closed, doc.scale);
      const first = out.measurements[0];
      return { ...l, measurementText: first ? first.text : null };
    }),
  };
}

/** Is this layer allowed to display a number yet? */
export function canMeasure(doc: MarkupDoc): boolean {
  return !!doc.scale && Number.isFinite(doc.scale.unitsPerPixel) && doc.scale.unitsPerPixel > 0;
}

/* ------------------------------------------------------------- export set */

export type MarkupExportKind =
  | "clean"
  | "image"
  | "shared_page"
  | "pdf_report"
  | "presentation"
  | "contractor_scope";

export const MARKUP_EXPORTS: { id: MarkupExportKind; label: string; hint: string }[] = [
  { id: "clean", label: "Clean Image", hint: "The photograph with no markup at all." },
  { id: "image", label: "Image With Markup", hint: "Flattened picture with the layers you choose." },
  { id: "shared_page", label: "Interactive Shared Page", hint: "A link where layers can be toggled." },
  { id: "pdf_report", label: "PDF Property Markup Report", hint: "Every callout, measurement and warning." },
  { id: "presentation", label: "Presentation Slide", hint: "Sends the marked image to a presentation." },
  { id: "contractor_scope", label: "Contractor Scope Export", hint: "Renovation and scope callouts only." },
];

/**
 * Which layers a given export actually paints. Layer visibility is the control:
 * a hidden layer never reaches an export, and a clean export paints none.
 */
export function exportLayers(
  doc: MarkupDoc,
  kind: MarkupExportKind,
  selectedIds?: string[] | null,
): MarkupLayer[] {
  if (kind === "clean") return [];
  const chosen = selectedIds && selectedIds.length ? new Set(selectedIds) : null;
  let layers = doc.layers.filter((l) => l.visible && (!chosen || chosen.has(l.id)));
  if (kind === "contractor_scope") {
    layers = layers.filter((l) => l.type === "renovation" || l.type === "scope_ref" || l.type === "work_zone");
  }
  return layers;
}

/**
 * The manifest written beside a flattened export. Vectors are flattened into
 * pixels only for the static file; this block keeps the document editable and
 * carries every warning the picture itself cannot state.
 */
export function markupExportManifest(
  doc: MarkupDoc,
  kind: MarkupExportKind,
  selectedIds?: string[] | null,
) {
  const layers = exportLayers(doc, kind, selectedIds);
  const parcelVisible = kind !== "clean" && !!doc.parcel;
  const warnings = [
    warningRequired(layers, false) ? MARKUP_WARNING : null,
    parcelVisible ? PARCEL_WARNING : null,
  ].filter(Boolean) as string[];
  return {
    export_kind: kind,
    exported_at: new Date().toISOString(),
    layer_ids: layers.map((l) => l.id),
    layer_count: layers.length,
    flattened: kind === "image" || kind === "presentation",
    /* The editable document always survives the flattening. */
    editable_document: serializeMarkup(doc),
    warnings,
    parcel_overlay_visible: parcelVisible,
    ...markupMetadata({ ...doc, layers }),
  };
}
