/**
 * Floorplan (2D To 3D Plan): the shared rulebook.
 *
 * The promise is narrow and testable — "convert a supported 2D floor plan into
 * a visually consistent furnished 3D concept while respecting the supplied
 * plan" — so everything that decides what the model is asked for lives here and
 * is shared by the panel, the server functions and the tests:
 *
 *  - which uploads are supported floor plans at all
 *  - the structured geometry that was actually read from the plan, per floor
 *  - every correction the user made to that reading
 *  - scale calibration and the dimensions that are genuinely known
 *  - the output types, and which settings each one really needs
 *  - the geometry lock the generation request must carry
 *  - the drift comparison run against the finished image
 *  - the interpreted plan data other tools (Sketch, Angles, Video, Budget) reuse
 *
 * Honest language is a hard rule here. Nothing in this file claims a dimension,
 * a scale or a wall was understood unless it was read off the plan or entered
 * by the user, and every output carries the concept disclosure.
 */

/* ------------------------------------------------------------ constants */

export const CONCEPT_DISCLAIMER =
  "Concept visualization—not architectural or construction documentation.";

export const FLOORPLAN_PROMISE =
  "Convert a supported 2D floor plan into a visually consistent furnished 3D concept while respecting the supplied plan.";

/** One generated view. Matches the 3D Plan price in the credit currency. */
export const CREDITS_PER_OUTPUT = 6;

/* -------------------------------------------------------------- helpers */

function num(v: unknown, d = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : d;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function clamp01(v: unknown): number {
  return clamp(num(v, 0), 0, 1);
}

function str(v: unknown, max: number): string | null {
  const s = String(v ?? "").trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "unknown") return null;
  return s.slice(0, max);
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/* -------------------------------------------------------- source classes */

export type PlanSourceId =
  | "floor_plan_image"
  | "blueprint"
  | "pdf_page"
  | "scanned_plan"
  | "dimensioned_sketch"
  | "site_plan"
  | "elevation"
  | "photograph"
  | "unsupported";

export type PlanSource = {
  id: PlanSourceId;
  label: string;
  blurb: string;
  supported: boolean;
};

export const PLAN_SOURCES: PlanSource[] = [
  {
    id: "floor_plan_image",
    label: "Floor Plan Image",
    blurb: "A plan view of one level with walls, rooms and openings.",
    supported: true,
  },
  {
    id: "blueprint",
    label: "Blueprint",
    blurb: "A measured architectural or construction plan.",
    supported: true,
  },
  {
    id: "pdf_page",
    label: "PDF Page",
    blurb: "One page of a plan set, imported as an image.",
    supported: true,
  },
  {
    id: "scanned_plan",
    label: "Scanned Plan",
    blurb: "A photographed or scanned paper plan.",
    supported: true,
  },
  {
    id: "dimensioned_sketch",
    label: "Sketch With Dimensions",
    blurb: "A hand plan with written measurements.",
    supported: true,
  },
  {
    id: "site_plan",
    label: "Site Plan",
    blurb: "A lot or landscape plan rather than an interior layout.",
    supported: false,
  },
  {
    id: "elevation",
    label: "Elevation",
    blurb: "A straight-on view of a facade, not a plan.",
    supported: false,
  },
  {
    id: "photograph",
    label: "Photograph",
    blurb: "A photo of a real space, not a drawing.",
    supported: false,
  },
  {
    id: "unsupported",
    label: "Not A Floor Plan",
    blurb: "Nothing in this image reads as a plan of a building.",
    supported: false,
  },
];

export const SUPPORTED_SOURCES = PLAN_SOURCES.filter((s) => s.supported);

export function planSource(id?: string | null): PlanSource {
  return PLAN_SOURCES.find((s) => s.id === id) || PLAN_SOURCES[PLAN_SOURCES.length - 1]!;
}

export function planSourceLabel(id?: string | null): string {
  return planSource(id).label;
}

export type PlanClassification = {
  kind: PlanSourceId;
  label: string;
  supported: boolean;
  confidence: number;
  summary: string | null;
  reason: string | null;
  alternatives: PlanSourceId[];
  /** Levels the reader believes are drawn on this page. */
  levels: number;
};

function sourceFrom(v: unknown): PlanSourceId | null {
  const raw = String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const hit = PLAN_SOURCES.find((s) => s.id === raw);
  if (hit) return hit.id;
  if (raw === "floor_plan" || raw === "plan" || raw === "layout") return "floor_plan_image";
  if (raw === "cad" || raw === "construction_drawing") return "blueprint";
  if (raw === "pdf" || raw === "document") return "pdf_page";
  if (raw === "scan" || raw === "photo_of_plan") return "scanned_plan";
  if (raw === "hand_sketch" || raw === "sketch") return "dimensioned_sketch";
  if (raw === "photo" || raw === "render") return "photograph";
  return null;
}

export function normalizeClassification(raw: unknown): PlanClassification {
  const r = (raw || {}) as Record<string, unknown>;
  const kind = sourceFrom(r["kind"] ?? r["type"]) || "unsupported";
  const src = planSource(kind);
  return {
    kind,
    label: src.label,
    supported: src.supported,
    confidence: clamp01(r["confidence"]),
    summary: str(r["summary"], 300),
    reason: str(r["reason"], 300),
    alternatives: (Array.isArray(r["alternatives"]) ? r["alternatives"] : [])
      .map((a) => sourceFrom(a))
      .filter((a): a is PlanSourceId => !!a)
      .slice(0, 3),
    levels: clamp(Math.round(num(r["levels"], 1)), 1, 6),
  };
}

/** Why an upload cannot be converted, in the user's words. */
export function rejectionMessage(c: PlanClassification | null): string | null {
  if (!c || c.supported) return null;
  if (c.kind === "photograph")
    return (
      "This looks like a photograph, not a floor plan. " +
      "Use Redesign or Stage for photos, or upload the plan drawing instead."
    );
  if (c.kind === "elevation")
    return "This is an elevation, not a plan. Use Sketch To Render for elevations, or upload the floor plan.";
  if (c.kind === "site_plan")
    return "This is a site or lot plan, so there is no interior layout to build. Upload the floor plan for the building.";
  return (
    (c.reason || "This image does not read as a floor plan.") +
    " Upload a plan view of the level you want converted."
  );
}

/** A supported but uncertain reading still gets said out loud. */
export function classificationWarning(c: PlanClassification | null): string | null {
  if (!c || !c.supported) return null;
  if (c.confidence >= 0.6) return null;
  const alt = c.alternatives.map((a) => planSourceLabel(a)).join(" or ");
  return (
    "This was read as a " +
    c.label +
    " with low confidence" +
    (alt ? " (it may be a " + alt + ")" : "") +
    ". Confirm the plan type before generating."
  );
}

/* -------------------------------------------------------------- geometry */

export type Box = { x: number; y: number; w: number; h: number };

export type PlanElementKind =
  | "wall"
  | "room"
  | "door"
  | "window"
  | "stair"
  | "fixture"
  | "label"
  | "dimension"
  | "scale_note";

export const PLAN_ELEMENT_KINDS: Array<{
  id: PlanElementKind;
  label: string;
  plural: string;
  blurb: string;
}> = [
  { id: "wall", label: "Wall", plural: "Walls", blurb: "A drawn wall or partition line." },
  { id: "room", label: "Room", plural: "Rooms", blurb: "An enclosed space or labelled area." },
  { id: "door", label: "Door", plural: "Doors", blurb: "A door, doorway or cased opening." },
  { id: "window", label: "Window", plural: "Windows", blurb: "A window or glazed opening." },
  { id: "stair", label: "Stair", plural: "Stairs", blurb: "A stair run, landing or stepped change of level." },
  {
    id: "fixture",
    label: "Fixture",
    plural: "Fixtures",
    blurb: "A fixed item drawn in plan: bath, sink, toilet, cabinets, appliances, fireplace.",
  },
  { id: "label", label: "Label", plural: "Labels", blurb: "Written room names or callouts." },
  { id: "dimension", label: "Dimension", plural: "Dimensions", blurb: "A written measurement." },
  { id: "scale_note", label: "Scale Note", plural: "Scale Notes", blurb: "A stated drawing scale or scale bar." },
];

export function elementKindLabel(id: string): string {
  return PLAN_ELEMENT_KINDS.find((k) => k.id === id)?.label || titleCase(String(id || "item"));
}

export type PlanElement = {
  id: string;
  kind: PlanElementKind;
  label: string;
  box: Box;
  /** Floor id this element belongs to. */
  floor: string;
  confidence: number;
  detail: string | null;
  /** Measurement exactly as written on the plan, or entered by the user. */
  dimension: string | null;
  origin: "detected" | "user";
};

export type UnitId = "ft" | "m" | "unknown";

export type ScaleCalibration = {
  /** True only when a scale was read off the plan or calibrated by the user. */
  known: boolean;
  reference: string | null;
  length: number | null;
  units: UnitId;
  source: "user" | "drawing" | null;
  /** Normalized on-image length of the reference, when the user calibrated. */
  pixels: number | null;
};

export type PlanFloor = {
  id: string;
  label: string;
  /** Order, 0 based, ground level first. */
  index: number;
};

export type PlanGeometry = {
  elements: PlanElement[];
  floors: PlanFloor[];
  units: UnitId;
  scale: ScaleCalibration;
  summary: string | null;
  warnings: string[];
};

export function emptyScale(): ScaleCalibration {
  return { known: false, reference: null, length: null, units: "unknown", source: null, pixels: null };
}

export function groundFloor(): PlanFloor {
  return { id: "floor-1", label: "Level 1", index: 0 };
}

export function emptyGeometry(): PlanGeometry {
  return {
    elements: [],
    floors: [groundFloor()],
    units: "unknown",
    scale: emptyScale(),
    summary: null,
    warnings: [],
  };
}

function kindFrom(v: unknown): PlanElementKind | null {
  const raw = String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const hit = PLAN_ELEMENT_KINDS.find((k) => k.id === raw);
  if (hit) return hit.id;
  if (raw === "walls" || raw === "partition" || raw === "exterior_wall") return "wall";
  if (raw === "space" || raw === "area" || raw === "zone" || raw === "rooms") return "room";
  if (raw === "doorway" || raw === "opening" || raw === "entry") return "door";
  if (raw === "glazing" || raw === "windows") return "window";
  if (raw === "stairs" || raw === "staircase" || raw === "steps") return "stair";
  if (
    raw === "plumbing" ||
    raw === "cabinet" ||
    raw === "cabinets" ||
    raw === "appliance" ||
    raw === "furniture" ||
    raw === "fireplace"
  )
    return "fixture";
  if (raw === "text" || raw === "note" || raw === "callout" || raw === "room_label") return "label";
  if (raw === "measurement" || raw === "dim" || raw === "dimensions") return "dimension";
  if (raw === "scale" || raw === "scale_bar") return "scale_note";
  return null;
}

function normBox(v: unknown): Box {
  const b = (v || {}) as Record<string, unknown>;
  const x = clamp01(b["x"]);
  const y = clamp01(b["y"]);
  return {
    x,
    y,
    w: clamp(num(b["w"], 0.1), 0.004, 1 - x),
    h: clamp(num(b["h"], 0.1), 0.004, 1 - y),
  };
}

export function unitFrom(v: unknown): UnitId {
  const raw = String(v ?? "").trim().toLowerCase();
  if (raw.startsWith("ft") || raw.startsWith("feet") || raw === "imperial" || raw === "'") return "ft";
  if (raw.startsWith("m") || raw === "metric" || raw === "mm" || raw === "cm") return "m";
  return "unknown";
}

/**
 * Turns a model reading into structured geometry. Multi-level plans keep every
 * level: the reader tags each element with a level, and each level becomes a
 * floor the user can generate separately.
 */
export function normalizeGeometry(raw: unknown, floorId?: string | null): PlanGeometry {
  const r = (raw || {}) as Record<string, unknown>;
  const list = Array.isArray(r["elements"]) ? r["elements"] : Array.isArray(r["items"]) ? r["items"] : [];
  const forced = str(floorId, 40);

  const floorsRaw = Array.isArray(r["floors"]) ? r["floors"] : [];
  const floors: PlanFloor[] = [];
  const floorKey = (v: unknown, i: number): string => {
    const s = String(v ?? "").trim();
    if (!s) return forced || "floor-1";
    const found = floors.find((f) => f.id === s || f.label.toLowerCase() === s.toLowerCase());
    if (found) return found.id;
    const id = forced || "floor-" + (floors.length + 1 || i + 1);
    floors.push({ id, label: titleCase(s), index: floors.length });
    return id;
  };
  floorsRaw.forEach((f, i) => {
    const e = (f || {}) as Record<string, unknown>;
    const label = str(e["label"] ?? e["name"] ?? e["id"], 40) || "Level " + (i + 1);
    if (!floors.some((x) => x.label.toLowerCase() === label.toLowerCase()))
      floors.push({ id: forced || "floor-" + (i + 1), label: titleCase(label), index: floors.length });
  });
  if (!floors.length) floors.push({ id: forced || "floor-1", label: "Level 1", index: 0 });

  const elements: PlanElement[] = [];
  list.forEach((entry, i) => {
    const e = (entry || {}) as Record<string, unknown>;
    const kind = kindFrom(e["kind"] ?? e["type"]);
    if (!kind) return;
    elements.push({
      id: String(e["id"] || kind + "-" + (i + 1)),
      kind,
      label: str(e["label"], 70) || elementKindLabel(kind),
      box: normBox(e["box"]),
      floor: forced || floorKey(e["floor"] ?? e["level"], 0),
      confidence: clamp01(e["confidence"]),
      detail: str(e["detail"], 180),
      dimension: str(e["dimension"], 40),
      origin: "detected",
    });
  });

  const scaleRaw = (r["scale"] || {}) as Record<string, unknown>;
  const noted = str(scaleRaw["note"], 120);
  const units = unitFrom(r["units"] ?? scaleRaw["units"]);
  return {
    elements,
    floors,
    units,
    /* A scale exists only when the plan states one. An estimate is not a scale. */
    scale: noted
      ? { known: true, reference: noted, length: null, units, source: "drawing", pixels: null }
      : emptyScale(),
    summary: str(r["summary"], 400),
    warnings: (Array.isArray(r["warnings"]) ? r["warnings"] : [])
      .map((w) => str(w, 200))
      .filter((w): w is string => !!w)
      .slice(0, 10),
  };
}

/** Merges a second page's reading in as another level. */
export function mergeFloor(base: PlanGeometry, next: PlanGeometry, label: string): PlanGeometry {
  const index = base.floors.length;
  const id = "floor-" + (index + 1);
  const floor: PlanFloor = { id, label: titleCase(label || "Level " + (index + 1)), index };
  return {
    ...base,
    floors: base.floors.concat(floor),
    elements: base.elements.concat(
      next.elements.map((e) => ({ ...e, id: id + "-" + e.id, floor: id })),
    ),
    warnings: base.warnings.concat(next.warnings).slice(0, 12),
  };
}

export function elementsOnFloor(g: PlanGeometry, floorId: string | null): PlanElement[] {
  if (!floorId) return g.elements;
  return g.elements.filter((e) => e.floor === floorId);
}

export function floorLabel(g: PlanGeometry, floorId: string | null): string {
  return g.floors.find((f) => f.id === floorId)?.label || g.floors[0]?.label || "Level 1";
}

export function geometryCounts(g: PlanGeometry, floorId?: string | null): Record<PlanElementKind, number> {
  const out = {} as Record<PlanElementKind, number>;
  PLAN_ELEMENT_KINDS.forEach((k) => {
    out[k.id] = 0;
  });
  elementsOnFloor(g, floorId ?? null).forEach((e) => {
    out[e.kind] = (out[e.kind] || 0) + 1;
  });
  return out;
}

/** Rooms the user can name, correct, regenerate or view individually. */
export function planRooms(g: PlanGeometry, floorId?: string | null): PlanElement[] {
  return elementsOnFloor(g, floorId ?? null).filter((e) => e.kind === "room");
}

export function uncertainElements(g: PlanGeometry, threshold = 0.55): PlanElement[] {
  return g.elements.filter((e) => e.origin === "detected" && e.confidence < threshold);
}

/** A plan is usable once walls or rooms exist — detected or drawn in by hand. */
export function geometryReady(g: PlanGeometry, floorId?: string | null): boolean {
  return elementsOnFloor(g, floorId ?? null).some((e) => e.kind === "wall" || e.kind === "room");
}

/* ----------------------------------------------------------- corrections */

let seq = 0;

function newId(prefix: string): string {
  seq += 1;
  return prefix + "-" + Date.now().toString(36) + "-" + seq;
}

export function addElement(
  g: PlanGeometry,
  input: { kind: PlanElementKind; label: string; box?: Box; floor?: string | null; dimension?: string | null },
): PlanGeometry {
  const el: PlanElement = {
    id: newId(input.kind),
    kind: input.kind,
    label: str(input.label, 70) || elementKindLabel(input.kind),
    box: input.box || { x: 0.35, y: 0.35, w: 0.3, h: 0.3 },
    floor: input.floor || g.floors[0]!.id,
    confidence: 1,
    detail: null,
    dimension: str(input.dimension, 40),
    origin: "user",
  };
  return { ...g, elements: g.elements.concat(el) };
}

export function removeElement(g: PlanGeometry, id: string): PlanGeometry {
  return { ...g, elements: g.elements.filter((e) => e.id !== id) };
}

/** Any correction promotes the element to "user": the reading is now theirs. */
export function correctElement(
  g: PlanGeometry,
  id: string,
  patch: { label?: string; dimension?: string | null; kind?: PlanElementKind },
): PlanGeometry {
  return {
    ...g,
    elements: g.elements.map((e) =>
      e.id === id
        ? {
            ...e,
            label: patch.label !== undefined ? str(patch.label, 70) || e.label : e.label,
            dimension:
              patch.dimension !== undefined ? str(patch.dimension, 40) : e.dimension,
            kind: patch.kind || e.kind,
            confidence: 1,
            origin: "user",
          }
        : e,
    ),
  };
}

export function correctionCount(g: PlanGeometry): number {
  return g.elements.filter((e) => e.origin === "user").length;
}

/* -------------------------------------------------------- scale and size */

export type DimensionEntry = {
  id: string;
  label: string;
  value: number;
  units: UnitId;
  entered: boolean;
};

export function dimensionsKnown(g: PlanGeometry, entered: DimensionEntry[]): boolean {
  return entered.length > 0 || g.elements.some((e) => !!e.dimension);
}

export function dimensionStatement(g: PlanGeometry, entered: DimensionEntry[]): string {
  const read = g.elements.filter((e) => !!e.dimension);
  if (!read.length && !entered.length)
    return "No dimensions were read from the plan and none were entered, so proportions follow the drawing only.";
  const parts: string[] = [];
  if (read.length) parts.push(read.length + " read from the plan");
  if (entered.length) parts.push(entered.length + " entered by you");
  return "Dimensions respected: " + parts.join(" and ") + ".";
}

export function scaleStatement(scale: ScaleCalibration): string {
  if (!scale.known || !scale.reference)
    return "No scale was calibrated, so sizes are relative to the drawing.";
  const size =
    scale.length != null ? " = " + scale.length + " " + (scale.units === "m" ? "m" : "ft") : "";
  return (
    "Scale calibrated against " +
    scale.reference +
    size +
    (scale.source === "drawing" ? " (stated on the plan)." : " (entered by you).")
  );
}

/**
 * Calibrates from a reference the user measured on the image: a normalized
 * length plus the real length it represents. Nothing is inferred without both.
 */
export function calibrateScale(input: {
  reference: string;
  length: number;
  units: UnitId;
  pixels?: number | null;
}): ScaleCalibration {
  const length = num(input.length, 0);
  if (!input.reference || length <= 0) return emptyScale();
  return {
    known: true,
    reference: str(input.reference, 120),
    length,
    units: input.units === "unknown" ? "ft" : input.units,
    source: "user",
    pixels: input.pixels != null ? clamp01(input.pixels) : null,
  };
}

/** Real length of a normalized on-image span, only when a scale exists. */
export function realLength(scale: ScaleCalibration, normalized: number): number | null {
  if (!scale.known || !scale.length || !scale.pixels) return null;
  const per = scale.length / scale.pixels;
  const out = per * clamp01(normalized);
  return Math.round(out * 10) / 10;
}

/* ------------------------------------------------------------- confidence */

export type ConfidenceBand = "high" | "medium" | "low";

export type ConfidenceReport = {
  score: number;
  band: ConfidenceBand;
  /** Element labels the reader was unsure about. */
  uncertain: string[];
  /** Things a plan normally has that were not found. */
  missing: string[];
  sentence: string;
  disclaimer: string;
};

export function geometryConfidence(g: PlanGeometry, floorId?: string | null): ConfidenceReport {
  const items = elementsOnFloor(g, floorId ?? null);
  const detected = items.filter((e) => e.origin === "detected");
  const avg = detected.length
    ? detected.reduce((a, e) => a + e.confidence, 0) / detected.length
    : items.length
      ? 1
      : 0;
  const counts = geometryCounts(g, floorId ?? null);
  const missing: string[] = [];
  if (!counts.wall) missing.push("No walls were traced");
  if (!counts.room) missing.push("No rooms were identified");
  if (!counts.door) missing.push("No doors were found");
  if (!counts.window) missing.push("No windows were found");
  if (!g.scale.known) missing.push("No scale was calibrated");
  const uncertain = uncertainElements(g)
    .filter((e) => !floorId || e.floor === floorId)
    .map((e) => e.label)
    .slice(0, 12);

  const penalty = Math.min(0.3, missing.length * 0.06);
  const score = Math.round(clamp(avg - penalty, 0, 1) * 100);
  const band: ConfidenceBand = score >= 75 ? "high" : score >= 50 ? "medium" : "low";
  const sentence =
    band === "high"
      ? "The plan was read clearly. Review the flagged items before generating."
      : band === "medium"
        ? "Parts of this plan were hard to read. Correct anything wrong before generating."
        : "This plan was read with low confidence. Correct the geometry yourself, or the concept will drift.";
  return { score, band, uncertain, missing, sentence, disclaimer: CONCEPT_DISCLAIMER };
}

/* ----------------------------------------------------------- output types */

export type OutputTypeId =
  | "furnished_3d"
  | "unfurnished_3d"
  | "isometric"
  | "eye_level"
  | "room_views";

export type OutputType = {
  id: OutputTypeId;
  label: string;
  blurb: string;
  needsStyle: boolean;
  needsFurniture: boolean;
  needsCamera: boolean;
  needsRooms: boolean;
  rule: string;
};

export const OUTPUT_TYPES: OutputType[] = [
  {
    id: "furnished_3d",
    label: "Furnished 3D Floor Plan",
    blurb: "Dollhouse view of the whole level with furniture in place.",
    needsStyle: true,
    needsFurniture: true,
    needsCamera: false,
    needsRooms: false,
    rule:
      "Render a furnished three dimensional dollhouse floor plan of this level, walls cut away at about waist height, " +
      "viewed from roughly 50 degrees above, with every room furnished for its labelled use.",
  },
  {
    id: "unfurnished_3d",
    label: "Unfurnished 3D Floor Plan",
    blurb: "The same dollhouse view with empty rooms and finishes only.",
    needsStyle: false,
    needsFurniture: false,
    needsCamera: false,
    needsRooms: false,
    rule:
      "Render an unfurnished three dimensional dollhouse floor plan of this level, walls cut away at about waist height, " +
      "viewed from roughly 50 degrees above. Show floor and wall finishes and built-in fixtures only. Place no loose furniture.",
  },
  {
    id: "isometric",
    label: "Isometric View",
    blurb: "A straight isometric projection of the level.",
    needsStyle: true,
    needsFurniture: true,
    needsCamera: false,
    needsRooms: false,
    rule:
      "Render this level as a clean isometric projection at a fixed 45 degree rotation with no perspective convergence, " +
      "walls cut away, the whole footprint visible inside the frame.",
  },
  {
    id: "eye_level",
    label: "Eye-Level Render",
    blurb: "A standing view from a camera you place on the plan.",
    needsStyle: true,
    needsFurniture: true,
    needsCamera: true,
    needsRooms: false,
    rule:
      "Render a photoreal eye-level interior view taken from the camera marker placed on the plan, standing height, " +
      "looking in the marked direction, showing only what that camera would actually see.",
  },
  {
    id: "room_views",
    label: "Individual Room Views",
    blurb: "One interior view per room you select.",
    needsStyle: true,
    needsFurniture: true,
    needsCamera: false,
    needsRooms: true,
    rule:
      "Render one photoreal interior view of the named room only, framed from its doorway, " +
      "with the room's own openings, fixtures and proportions exactly as drawn on the plan.",
  },
];

export function outputType(id?: string | null): OutputType {
  return OUTPUT_TYPES.find((o) => o.id === id) || OUTPUT_TYPES[0]!;
}

/* --------------------------------------------------------- look settings */

export const FURNITURE_LEVELS: Array<{ id: string; label: string; rule: string }> = [
  { id: "none", label: "Empty", rule: "Place no loose furniture at all; built-in fixtures only." },
  {
    id: "light",
    label: "Light",
    rule: "Furnish sparsely: only the primary piece each room needs, nothing decorative.",
  },
  {
    id: "full",
    label: "Full",
    rule: "Furnish every room completely for its labelled use, at realistic scale for the drawn dimensions.",
  },
  {
    id: "styled",
    label: "Styled",
    rule: "Furnish every room completely and add décor, rugs, art and plants as a stylist would.",
  },
];

export const FINISH_GRADES: Array<{ id: string; label: string; rule: string }> = [
  { id: "builder", label: "Builder Grade", rule: "Everyday materials and simple trim." },
  { id: "mid", label: "Mid Market", rule: "Quality mainstream materials with clean detailing." },
  { id: "premium", label: "Premium", rule: "High-end materials, careful detailing and layered lighting." },
];

export function furnitureLevel(id?: string | null) {
  return FURNITURE_LEVELS.find((f) => f.id === id) || FURNITURE_LEVELS[2]!;
}

export function finishGrade(id?: string | null) {
  return FINISH_GRADES.find((f) => f.id === id) || FINISH_GRADES[1]!;
}

/* -------------------------------------------------------------- cameras */

export type CameraMarker = {
  id: string;
  /** Normalized position on the plan image. */
  x: number;
  y: number;
  /** Compass-style heading in degrees, 0 = up the page. */
  direction: number;
  /** Eye height in the plan's units. */
  height: number;
  fov: number;
  label: string;
  floor: string;
};

export const DEFAULT_EYE_HEIGHT_FT = 5.4;

export function cameraMarker(partial: Partial<CameraMarker> & { id: string }): CameraMarker {
  return {
    id: partial.id,
    x: clamp01(partial.x ?? 0.5),
    y: clamp01(partial.y ?? 0.5),
    direction: clamp(Math.round(num(partial.direction, 0)), 0, 359),
    height: clamp(num(partial.height, DEFAULT_EYE_HEIGHT_FT), 1, 30),
    fov: clamp(num(partial.fov, 60), 20, 120),
    label: str(partial.label, 40) || "Camera",
    floor: partial.floor || "floor-1",
  };
}

export function directionLabel(deg: number): string {
  const names = ["Up The Page", "Up And Right", "Right", "Down And Right", "Down The Page", "Down And Left", "Left", "Up And Left"];
  return names[Math.round(((deg % 360) + 360) % 360 / 45) % 8]!;
}

export function cameraSentence(c: CameraMarker, units: UnitId): string {
  const u = units === "m" ? "m" : "ft";
  return (
    c.label +
    " stands at " +
    Math.round(c.x * 100) +
    "% across and " +
    Math.round(c.y * 100) +
    "% down the plan, looking " +
    directionLabel(c.direction).toLowerCase() +
    ", eye height " +
    c.height +
    u +
    ", " +
    c.fov +
    " degree lens."
  );
}

/* ------------------------------------------------------------ geometry lock */

export const GEOMETRY_LOCK_RULES: string[] = [
  "The supplied plan is the authority. Build only what it draws.",
  "Keep every room in the same relative position, with the same neighbours and the same connections.",
  "Keep wall positions, wall runs and the outer footprint exactly as drawn. Do not straighten, square up or simplify them.",
  "Keep every door and window in the wall it is drawn in, on the same side, in the same order along that wall.",
  "Keep stairs in the drawn location, with the drawn run direction.",
  "Keep drawn fixtures — baths, sinks, toilets, cabinets, appliances, fireplaces — in their drawn positions.",
  "Do not add rooms, walls, doors, windows, stairs or levels that are not on the plan, and do not delete any that are.",
  "Where the plan is unreadable, keep the area plain and simple rather than inventing detail.",
];

/* --------------------------------------------------------------- payload */

export type PlanPayloadElement = {
  id: string;
  kind: PlanElementKind;
  label: string;
  box: Box;
  dimension: string | null;
  detail: string | null;
  origin: "detected" | "user";
};

export type FloorplanPayload = {
  source_kind: PlanSourceId;
  source_label: string;
  output: OutputTypeId;
  output_label: string;
  output_rule: string;
  floor_id: string;
  floor_label: string;
  floors_total: number;
  style_id: string | null;
  style_name: string | null;
  furniture_level: string;
  furniture_label: string;
  furniture_rule: string;
  finish_grade: string;
  finish_label: string;
  finish_rule: string;
  units: UnitId;
  scale: ScaleCalibration;
  scale_statement: string;
  dimensions: DimensionEntry[];
  dimensions_known: boolean;
  dimension_statement: string;
  geometry: PlanPayloadElement[];
  geometry_summary: string | null;
  rooms: string[];
  camera: CameraMarker | null;
  uncertain: string[];
  confidence: number;
  notes: string | null;
  plan_id: string;
  disclaimer: string;
};

export type FloorplanRun = {
  id: string;
  label: string;
  /** Extra directive for this run: which room, which camera. */
  directive: string;
  /** Room element id, for selective room regeneration. */
  roomId: string | null;
};

export type FloorplanBrief = {
  valid: boolean;
  missing: string[];
  credits: number;
  payload: FloorplanPayload;
  runs: FloorplanRun[];
  disclaimer: string;
};

export type FloorplanSettings = {
  hasSource: boolean;
  classification: PlanClassification | null;
  geometry: PlanGeometry;
  floorId: string;
  output: OutputTypeId;
  furniture: string;
  finish: string;
  dimensions: DimensionEntry[];
  camera: CameraMarker | null;
  /** Room element ids selected for Individual Room Views. */
  roomIds: string[];
  styleId: string | null;
  styleName: string | null;
  notes: string | null;
  planId: string;
  /** True when the interpretation review has been seen and accepted. */
  reviewed: boolean;
};

export function newPlanId(): string {
  return "plan-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}

export function floorplanCredits(runs: number): number {
  return Math.max(1, runs) * CREDITS_PER_OUTPUT;
}

export function costSentence(brief: { credits: number; runs: FloorplanRun[] }): string {
  const n = brief.runs.length || 1;
  return (
    brief.credits +
    " credit" +
    (brief.credits === 1 ? "" : "s") +
    " for " +
    n +
    (n === 1 ? " view" : " views") +
    ". A view that fails is refunded. " +
    CONCEPT_DISCLAIMER
  );
}

export function defaultSettings(): FloorplanSettings {
  return {
    hasSource: false,
    classification: null,
    geometry: emptyGeometry(),
    floorId: "floor-1",
    output: "furnished_3d",
    furniture: "full",
    finish: "mid",
    dimensions: [],
    camera: null,
    roomIds: [],
    styleId: null,
    styleName: null,
    notes: null,
    planId: newPlanId(),
    reviewed: false,
  };
}

export function buildRuns(s: FloorplanSettings, g: PlanGeometry): FloorplanRun[] {
  const type = outputType(s.output);
  if (type.needsRooms) {
    const rooms = planRooms(g, s.floorId).filter((r) => s.roomIds.indexOf(r.id) > -1);
    return rooms.map((r) => ({
      id: r.id,
      label: r.label,
      directive:
        "Render " +
        r.label +
        " only" +
        (r.dimension ? ", drawn as " + r.dimension : "") +
        ". Every other room stays out of frame.",
      roomId: r.id,
    }));
  }
  if (type.needsCamera && s.camera) {
    return [
      {
        id: s.camera.id,
        label: s.camera.label,
        directive: cameraSentence(s.camera, g.units),
        roomId: null,
      },
    ];
  }
  return [{ id: "main", label: type.label, directive: "", roomId: null }];
}

export function buildFloorplanBrief(s: FloorplanSettings): FloorplanBrief {
  const g = s.geometry;
  const type = outputType(s.output);
  const missing: string[] = [];

  if (!s.hasSource) missing.push("Upload A Floor Plan");
  if (s.classification && !s.classification.supported) missing.push("Upload A Supported Floor Plan");
  if (!geometryReady(g, s.floorId)) missing.push("Read Or Draw The Plan Geometry");
  if (!s.reviewed) missing.push("Review The Interpretation");
  if (type.needsStyle && !s.styleId) missing.push("Choose A Design Style");
  if (type.needsCamera && !s.camera) missing.push("Place A Camera Marker");
  if (type.needsRooms && !s.roomIds.length) missing.push("Select At Least One Room");

  const runs = buildRuns(s, g);
  if (!runs.length && !missing.length) missing.push("Select At Least One Room");

  const items = elementsOnFloor(g, s.floorId);
  const report = geometryConfidence(g, s.floorId);
  const furniture = furnitureLevel(type.needsFurniture ? s.furniture : "none");
  const finish = finishGrade(s.finish);

  const payload: FloorplanPayload = {
    source_kind: s.classification?.kind || "floor_plan_image",
    source_label: planSourceLabel(s.classification?.kind || "floor_plan_image"),
    output: type.id,
    output_label: type.label,
    output_rule: type.rule,
    floor_id: s.floorId,
    floor_label: floorLabel(g, s.floorId),
    floors_total: g.floors.length,
    style_id: type.needsStyle ? s.styleId : null,
    style_name: type.needsStyle ? s.styleName : null,
    furniture_level: furniture.id,
    furniture_label: furniture.label,
    furniture_rule: furniture.rule,
    finish_grade: finish.id,
    finish_label: finish.label,
    finish_rule: finish.rule,
    units: g.units,
    scale: g.scale,
    scale_statement: scaleStatement(g.scale),
    dimensions: s.dimensions.slice(0, 24),
    dimensions_known: dimensionsKnown(g, s.dimensions),
    dimension_statement: dimensionStatement(g, s.dimensions),
    geometry: items.slice(0, 160).map((e) => ({
      id: e.id,
      kind: e.kind,
      label: e.label,
      box: e.box,
      dimension: e.dimension,
      detail: e.detail,
      origin: e.origin,
    })),
    geometry_summary: g.summary,
    rooms: planRooms(g, s.floorId).map((r) => r.label),
    camera: type.needsCamera ? s.camera : null,
    uncertain: report.uncertain,
    confidence: report.score,
    notes: str(s.notes, 600),
    plan_id: s.planId,
    disclaimer: CONCEPT_DISCLAIMER,
  };

  return {
    valid: !missing.length,
    missing,
    credits: floorplanCredits(runs.length),
    payload,
    runs,
    disclaimer: CONCEPT_DISCLAIMER,
  };
}

/* ---------------------------------------------------------------- prompt */

function boxSentence(b: Box): string {
  const pct = (n: number) => Math.round(n * 100) + "%";
  return "x " + pct(b.x) + ", y " + pct(b.y) + ", w " + pct(b.w) + ", h " + pct(b.h);
}

export function floorplanPrompt(payload: FloorplanPayload, run: FloorplanRun | null): string {
  const lines: string[] = [];
  lines.push(
    "You are converting an attached two dimensional " +
      payload.source_label.toLowerCase() +
      " into a three dimensional concept visualization.",
  );
  lines.push(payload.output_rule);
  if (run?.directive) lines.push(run.directive);
  if (payload.floors_total > 1)
    lines.push(
      "This plan has " +
        payload.floors_total +
        " levels. Build " +
        payload.floor_label +
        " only, and show no other level.",
    );

  lines.push("");
  lines.push("PLAN LOCK — these are not suggestions:");
  GEOMETRY_LOCK_RULES.forEach((r) => lines.push("- " + r));

  if (payload.geometry.length) {
    lines.push("");
    lines.push("STRUCTURED GEOMETRY READ FROM THE PLAN (positions are fractions of the image):");
    PLAN_ELEMENT_KINDS.forEach((k) => {
      const items = payload.geometry.filter((e) => e.kind === k.id);
      if (!items.length) return;
      lines.push(k.plural + ":");
      items.forEach((e) =>
        lines.push(
          "  - " +
            e.label +
            " [" +
            boxSentence(e.box) +
            "]" +
            (e.dimension ? ", drawn as " + e.dimension : "") +
            (e.detail ? " — " + e.detail : "") +
            (e.origin === "user" ? " (corrected by the user, treat as certain)" : ""),
        ),
      );
    });
  }
  if (payload.geometry_summary) lines.push("Plan summary: " + payload.geometry_summary);

  lines.push("");
  lines.push(payload.scale_statement);
  lines.push(payload.dimension_statement);
  if (payload.dimensions.length)
    lines.push(
      "Known measurements: " +
        payload.dimensions
          .map((d) => d.label + " " + d.value + (d.units === "m" ? "m" : "ft"))
          .join(", ") +
        ". Match these proportions.",
    );
  if (!payload.dimensions_known)
    lines.push(
      "No measurement is confirmed, so keep proportions consistent with the drawing and never state a size in the image.",
    );
  if (payload.uncertain.length)
    lines.push(
      "Uncertain areas — keep these simple and do not invent detail: " +
        payload.uncertain.join(", ") +
        ".",
    );

  if (payload.style_name) lines.push("");
  if (payload.style_name)
    lines.push("Design style: " + payload.style_name + ". Apply it to finishes, furniture and lighting.");
  lines.push("Furnishing: " + payload.furniture_rule);
  lines.push("Finish level: " + payload.finish_label + ". " + payload.finish_rule);
  if (payload.camera) lines.push("Camera: " + cameraSentence(payload.camera, payload.units));
  if (payload.notes) lines.push("User instructions (never override the plan lock): " + payload.notes);

  lines.push("");
  lines.push(
    "Photoreal materials, soft even daylight, no text, no room labels, no dimension lines, no watermarks, no people.",
  );
  lines.push(
    "This is a concept visualization, not construction documentation. Do not draw anything that implies measured accuracy.",
  );
  return lines.join("\n");
}

/* ----------------------------------------------------------------- drift */

export type DriftCheckId =
  | "room_count"
  | "room_layout"
  | "wall_footprint"
  | "openings"
  | "stairs"
  | "fixtures"
  | "invented";

export const DRIFT_CHECKS: Array<{ id: DriftCheckId; label: string; question: string }> = [
  { id: "room_count", label: "Room Count", question: "Does the render show the same number of rooms as the plan?" },
  { id: "room_layout", label: "Room Layout", question: "Are the rooms in the same relative positions as the plan?" },
  { id: "wall_footprint", label: "Footprint", question: "Does the outer footprint and wall layout match the plan?" },
  { id: "openings", label: "Doors And Windows", question: "Are doors and windows in the same walls and positions?" },
  { id: "stairs", label: "Stairs", question: "Are stairs present, in the drawn place, running the drawn way?" },
  { id: "fixtures", label: "Fixtures", question: "Are drawn fixtures in their drawn positions?" },
  { id: "invented", label: "Invented Structure", question: "Did the render add rooms, walls or openings that are not on the plan?" },
];

export type DriftIssue = { id: DriftCheckId; severity: "minor" | "major"; detail: string };

export type DriftReport = {
  issues: DriftIssue[];
  major: boolean;
  headline: string;
  disclaimer: string;
};

export function normalizeDrift(raw: unknown): DriftReport {
  const r = (raw || {}) as Record<string, unknown>;
  const list = Array.isArray(r["issues"]) ? r["issues"] : [];
  const issues: DriftIssue[] = [];
  list.forEach((entry) => {
    const e = (entry || {}) as Record<string, unknown>;
    const id = DRIFT_CHECKS.find((c) => c.id === String(e["id"] || "").trim())?.id;
    if (!id) return;
    const detail = str(e["detail"], 240);
    if (!detail) return;
    issues.push({ id, severity: String(e["severity"]) === "major" ? "major" : "minor", detail });
  });
  return summarizeDrift(issues);
}

export function summarizeDrift(issues: DriftIssue[]): DriftReport {
  const major = issues.some((i) => i.severity === "major");
  const headline = !issues.length
    ? "The concept follows your plan."
    : major
      ? "This concept drifted from your plan"
      : "Small differences from your plan";
  return { issues, major, headline, disclaimer: CONCEPT_DISCLAIMER };
}

/* ------------------------------------------------------ material schedule */

export type ScheduleRow = { area: string; surface: string; note: string };

/**
 * An indicative schedule of what the concept shows. It is never a
 * specification: no brands, no products, no quantities, no prices.
 */
export function materialSchedule(payload: FloorplanPayload): {
  rows: ScheduleRow[];
  note: string;
  disclaimer: string;
} {
  const style = payload.style_name || "the chosen style";
  const finish = payload.finish_label.toLowerCase();
  const rows: ScheduleRow[] = [];
  const rooms = payload.rooms.length ? payload.rooms : ["Whole Level"];
  rooms.slice(0, 14).forEach((room) => {
    const r = room.toLowerCase();
    const wet = /bath|shower|wc|toilet|laundry|utility/.test(r);
    const kitchen = /kitchen|pantry/.test(r);
    rows.push({
      area: room,
      surface: wet || kitchen ? "Floor, walls and worktops" : "Floor, walls and trim",
      note:
        (wet ? "Tiled wet-area finishes" : kitchen ? "Durable worktop and splashback" : "Soft-underfoot flooring") +
        " in " +
        style +
        ", " +
        finish +
        " level.",
    });
  });
  if (payload.furniture_level !== "none")
    rows.push({
      area: "Furniture",
      surface: payload.furniture_label + " furnishing",
      note: payload.furniture_rule,
    });
  return {
    rows,
    note: "Indicative of what the concept shows. No products, quantities or costs are specified.",
    disclaimer: CONCEPT_DISCLAIMER,
  };
}

/* ------------------------------------------------- interpreted plan data */

/**
 * The structured plan other tools reuse. Sketch renders from it, Angles takes
 * its cameras, Video reads the room order, Budget reads the room list. It is
 * data only: it never carries a claim of measured accuracy.
 */
export type InterpretedPlan = {
  version: 1;
  plan_id: string;
  source_kind: PlanSourceId;
  units: UnitId;
  scale: ScaleCalibration;
  dimensions_known: boolean;
  confidence: number;
  floors: Array<{
    id: string;
    label: string;
    rooms: Array<{ id: string; label: string; box: Box; dimension: string | null }>;
    doors: number;
    windows: number;
    stairs: number;
    fixtures: Array<{ label: string; box: Box }>;
    walls: number;
  }>;
  cameras: CameraMarker[];
  warnings: string[];
  disclaimer: string;
};

export function exportPlanData(input: {
  planId: string;
  sourceKind: PlanSourceId;
  geometry: PlanGeometry;
  dimensions: DimensionEntry[];
  cameras: CameraMarker[];
}): InterpretedPlan {
  const g = input.geometry;
  return {
    version: 1,
    plan_id: input.planId,
    source_kind: input.sourceKind,
    units: g.units,
    scale: g.scale,
    dimensions_known: dimensionsKnown(g, input.dimensions),
    confidence: geometryConfidence(g).score,
    floors: g.floors.map((f) => {
      const items = elementsOnFloor(g, f.id);
      const count = (k: PlanElementKind) => items.filter((e) => e.kind === k).length;
      return {
        id: f.id,
        label: f.label,
        rooms: items
          .filter((e) => e.kind === "room")
          .map((e) => ({ id: e.id, label: e.label, box: e.box, dimension: e.dimension })),
        doors: count("door"),
        windows: count("window"),
        stairs: count("stair"),
        fixtures: items.filter((e) => e.kind === "fixture").map((e) => ({ label: e.label, box: e.box })),
        walls: count("wall"),
      };
    }),
    cameras: input.cameras,
    warnings: g.warnings,
    disclaimer: CONCEPT_DISCLAIMER,
  };
}

/** The same interpretation as readable text, for download. */
export function exportPlanText(input: {
  planId: string;
  sourceKind: PlanSourceId;
  geometry: PlanGeometry;
  dimensions: DimensionEntry[];
  cameras: CameraMarker[];
}): string {
  const g = input.geometry;
  const lines: string[] = [];
  lines.push("REAL DESIGNS — INTERPRETED FLOOR PLAN");
  lines.push(CONCEPT_DISCLAIMER);
  lines.push("Generated " + new Date().toISOString());
  lines.push("");
  lines.push("Source type: " + planSourceLabel(input.sourceKind));
  lines.push("Units: " + (g.units === "unknown" ? "not stated" : g.units));
  lines.push(scaleStatement(g.scale));
  lines.push(dimensionStatement(g, input.dimensions));
  const report = geometryConfidence(g);
  lines.push("Geometry confidence: " + report.score + "% (" + report.band + ")");
  if (g.summary) lines.push("Summary: " + g.summary);
  g.floors.forEach((f) => {
    lines.push("");
    lines.push(f.label.toUpperCase());
    PLAN_ELEMENT_KINDS.forEach((k) => {
      const items = elementsOnFloor(g, f.id).filter((e) => e.kind === k.id);
      if (!items.length) return;
      lines.push("  " + k.plural + ":");
      items.forEach((e) =>
        lines.push(
          "  - " +
            e.label +
            " [" +
            boxSentence(e.box) +
            "]" +
            (e.dimension ? " " + e.dimension : "") +
            (e.origin === "user" ? " (corrected)" : " (" + Math.round(e.confidence * 100) + "% confidence)"),
        ),
      );
    });
  });
  if (input.dimensions.length) {
    lines.push("");
    lines.push("DIMENSIONS");
    input.dimensions.forEach((d) =>
      lines.push("- " + d.label + ": " + d.value + " " + d.units + (d.entered ? " (entered)" : " (read)")),
    );
  }
  if (input.cameras.length) {
    lines.push("");
    lines.push("CAMERAS");
    input.cameras.forEach((c) => lines.push("- " + cameraSentence(c, g.units)));
  }
  if (report.missing.length) {
    lines.push("");
    lines.push("NOT ESTABLISHED");
    report.missing.forEach((m) => lines.push("- " + m));
  }
  if (g.warnings.length) {
    lines.push("");
    lines.push("UNRESOLVED");
    g.warnings.forEach((w) => lines.push("- " + w));
  }
  return lines.join("\n");
}

/* ----------------------------------------------------------- persistence */

export const FLOORPLAN_CLASSIFICATION = "3D Plan Concept";

export type FloorplanMeta = {
  tool: "Floorplan";
  classification: string;
  plan_id: string;
  source_kind: PlanSourceId;
  output: OutputTypeId;
  output_label: string;
  floor_id: string;
  floor_label: string;
  floors_total: number;
  geometry: PlanPayloadElement[];
  geometry_summary: string | null;
  corrections: number;
  units: UnitId;
  scale: ScaleCalibration;
  dimensions: DimensionEntry[];
  dimensions_known: boolean;
  confidence: number;
  style_id: string | null;
  style_name: string | null;
  furniture_level: string;
  finish_grade: string;
  camera: CameraMarker | null;
  room: string | null;
  instructions: string | null;
  plan_data: InterpretedPlan | null;
  drift: DriftIssue[];
  source_version: string | null;
  run: string;
  model: string;
  disclaimer: string;
  at: string;
};

export function floorplanMeta(input: {
  payload: FloorplanPayload;
  sourceVersion: string | null;
  run: string;
  roomLabel?: string | null;
  model?: string;
  drift?: DriftIssue[];
  planData?: InterpretedPlan | null;
  corrections?: number;
}): FloorplanMeta {
  const p = input.payload;
  return {
    tool: "Floorplan",
    classification: FLOORPLAN_CLASSIFICATION,
    plan_id: p.plan_id,
    source_kind: p.source_kind,
    output: p.output,
    output_label: p.output_label,
    floor_id: p.floor_id,
    floor_label: p.floor_label,
    floors_total: p.floors_total,
    geometry: p.geometry,
    geometry_summary: p.geometry_summary,
    corrections: input.corrections ?? p.geometry.filter((e) => e.origin === "user").length,
    units: p.units,
    scale: p.scale,
    dimensions: p.dimensions,
    dimensions_known: p.dimensions_known,
    confidence: p.confidence,
    style_id: p.style_id,
    style_name: p.style_name,
    furniture_level: p.furniture_level,
    finish_grade: p.finish_grade,
    camera: p.camera,
    room: input.roomLabel || null,
    instructions: p.notes,
    plan_data: input.planData || null,
    drift: input.drift || [],
    source_version: input.sourceVersion,
    run: input.run,
    model: input.model || "",
    disclaimer: CONCEPT_DISCLAIMER,
    at: new Date().toISOString(),
  };
}

export type RestoredFloorplan = {
  planId: string;
  classification: PlanClassification | null;
  geometry: PlanGeometry;
  floorId: string;
  output: OutputTypeId;
  furniture: string;
  finish: string;
  dimensions: DimensionEntry[];
  camera: CameraMarker | null;
  notes: string | null;
};

/** Reopens a saved 3D plan exactly as it was generated, corrections included. */
export function restoreFromMeta(meta: unknown): RestoredFloorplan | null {
  const m = (meta || {}) as Record<string, unknown>;
  if (String(m["tool"] || "") !== "Floorplan") return null;
  const geometry = emptyGeometry();
  const floorId = String(m["floor_id"] || "floor-1");
  const total = clamp(Math.round(num(m["floors_total"], 1)), 1, 6);
  geometry.floors = Array.from({ length: total }, (_, i) => ({
    id: "floor-" + (i + 1),
    label: "Level " + (i + 1),
    index: i,
  }));
  if (!geometry.floors.some((f) => f.id === floorId))
    geometry.floors.push({ id: floorId, label: "Level " + (geometry.floors.length + 1), index: geometry.floors.length });
  const list = Array.isArray(m["geometry"]) ? (m["geometry"] as unknown[]) : [];
  geometry.elements = list
    .map((entry, i) => {
      const e = (entry || {}) as Record<string, unknown>;
      const kind = kindFrom(e["kind"]);
      if (!kind) return null;
      return {
        id: String(e["id"] || kind + "-" + (i + 1)),
        kind,
        label: str(e["label"], 70) || elementKindLabel(kind),
        box: normBox(e["box"]),
        floor: floorId,
        confidence: 1,
        detail: str(e["detail"], 180),
        dimension: str(e["dimension"], 40),
        origin: String(e["origin"] || "detected") === "user" ? "user" : "detected",
      } as PlanElement;
    })
    .filter((e): e is PlanElement => !!e);
  geometry.units = unitFrom(m["units"]);
  const scale = (m["scale"] || {}) as Record<string, unknown>;
  geometry.scale = scale["known"]
    ? {
        known: true,
        reference: str(scale["reference"], 120),
        length: scale["length"] == null ? null : num(scale["length"], 0),
        units: unitFrom(scale["units"]),
        source: String(scale["source"]) === "drawing" ? "drawing" : "user",
        pixels: scale["pixels"] == null ? null : clamp01(scale["pixels"]),
      }
    : emptyScale();

  const cam = (m["camera"] || null) as Record<string, unknown> | null;
  return {
    planId: String(m["plan_id"] || newPlanId()),
    classification: m["source_kind"]
      ? normalizeClassification({ kind: m["source_kind"], confidence: 1 })
      : null,
    geometry,
    floorId,
    output: outputType(String(m["output"] || "")).id,
    furniture: furnitureLevel(String(m["furniture_level"] || "")).id,
    finish: finishGrade(String(m["finish_grade"] || "")).id,
    dimensions: (Array.isArray(m["dimensions"]) ? (m["dimensions"] as unknown[]) : [])
      .map((d, i) => {
        const e = (d || {}) as Record<string, unknown>;
        return {
          id: String(e["id"] || "dim-" + (i + 1)),
          label: str(e["label"], 60) || "Dimension",
          value: num(e["value"], 0),
          units: unitFrom(e["units"]),
          entered: !!e["entered"],
        };
      })
      .filter((d) => d.value > 0),
    camera: cam ? cameraMarker({ ...(cam as any), id: String(cam["id"] || "cam-1") }) : null,
    notes: str(m["instructions"], 600),
  };
}
