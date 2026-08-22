/**
 * Sketch To Render: the shared rulebook.
 *
 * The promise of this tool is narrow and testable — "turn a hand sketch, floor
 * plan or line drawing into a believable render that follows the uploaded
 * geometry" — so everything that decides what is sent to the model lives here
 * and is shared by the panel, the server and the tests:
 *
 * - what kind of drawing was uploaded, and whether it is supported at all
 * - the structured geometry that was actually detected (never assumed)
 * - the camera the user placed, in real units where they were supplied
 * - the geometry lock the generation request must carry
 * - the drift comparison run against the finished render
 * - the metadata a saved version needs so it reopens exactly as it was
 *
 * Honest language is a hard rule in this file: nothing here ever claims a
 * dimension was understood unless it was detected or typed in by the user, and
 * every output is labelled a concept visualization.
 */

/* ------------------------------------------------------------ constants */

export const CONCEPT_DISCLAIMER = "Concept visualization—not construction documents.";

export const SKETCH_PROMISE =
  "Turn a hand sketch, floor plan or line drawing into a believable render that follows the uploaded geometry.";

export const CREDITS_PER_RESULT = 1;

/* ------------------------------------------------------- source classes */

export type SketchKindId =
  | "hand_sketch"
  | "floor_plan"
  | "blueprint"
  | "elevation"
  | "line_drawing"
  | "annotated_concept"
  | "photograph"
  | "unsupported";

export type SketchKind = {
  id: SketchKindId;
  label: string;
  blurb: string;
  supported: boolean;
  /** True when the drawing is a plan seen from above. */
  plan: boolean;
};

export const SKETCH_KINDS: SketchKind[] = [
  {
    id: "hand_sketch",
    label: "Hand Sketch",
    blurb: "A freehand drawing of a space or a building.",
    supported: true,
    plan: false,
  },
  {
    id: "floor_plan",
    label: "Floor Plan",
    blurb: "A plan view with walls, rooms and openings.",
    supported: true,
    plan: true,
  },
  {
    id: "blueprint",
    label: "Blueprint",
    blurb: "A measured architectural plan or construction drawing.",
    supported: true,
    plan: true,
  },
  {
    id: "elevation",
    label: "Elevation",
    blurb: "A straight-on view of one facade or wall.",
    supported: true,
    plan: false,
  },
  {
    id: "line_drawing",
    label: "Digital Line Drawing",
    blurb: "A CAD, vector or digital outline drawing.",
    supported: true,
    plan: false,
  },
  {
    id: "annotated_concept",
    label: "Annotated Concept Drawing",
    blurb: "A sketch with written notes, labels or callouts.",
    supported: true,
    plan: false,
  },
  {
    id: "photograph",
    label: "Photograph",
    blurb: "A photo of a real space, not a drawing.",
    supported: false,
    plan: false,
  },
  {
    id: "unsupported",
    label: "Not A Drawing",
    blurb: "Nothing in this image reads as a drawing of a space.",
    supported: false,
    plan: false,
  },
];

export const SUPPORTED_KINDS = SKETCH_KINDS.filter((k) => k.supported);

export function sketchKind(id?: string | null): SketchKind {
  return SKETCH_KINDS.find((k) => k.id === id) || SKETCH_KINDS[SKETCH_KINDS.length - 1]!;
}

export function sketchKindLabel(id?: string | null): string {
  return sketchKind(id).label;
}

export type SourceClassification = {
  kind: SketchKindId;
  label: string;
  confidence: number;
  summary: string | null;
  /** Why an unsupported image was refused, in the user's language. */
  reason: string | null;
  supported: boolean;
  /** Other readings worth offering when the model was unsure. */
  alternatives: SketchKindId[];
  /** True once the user has confirmed or corrected the classification. */
  confirmed: boolean;
};

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function clamp01(v: unknown): number {
  return clamp(num(v, 0), 0, 1);
}

function str(v: unknown, max = 200): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function kindFrom(v: unknown): SketchKindId | null {
  const raw = String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const hit = SKETCH_KINDS.find((k) => k.id === raw);
  if (hit) return hit.id;
  if (raw === "sketch" || raw === "hand_drawing") return "hand_sketch";
  if (raw === "plan" || raw === "floorplan") return "floor_plan";
  if (raw === "cad" || raw === "vector" || raw === "drawing") return "line_drawing";
  if (raw === "photo" || raw === "photograph" || raw === "render") return "photograph";
  return null;
}

export function normalizeClassification(raw: unknown): SourceClassification {
  const r = (raw || {}) as Record<string, unknown>;
  const kind = kindFrom(r["kind"] ?? r["type"]) || "unsupported";
  const meta = sketchKind(kind);
  const alternatives = (Array.isArray(r["alternatives"]) ? r["alternatives"] : [])
    .map((a) => kindFrom(a))
    .filter((a): a is SketchKindId => !!a && a !== kind)
    .slice(0, 3);
  return {
    kind,
    label: meta.label,
    confidence: clamp01(r["confidence"]),
    summary: str(r["summary"], 300),
    reason: str(r["reason"], 300),
    supported: meta.supported,
    alternatives,
    confirmed: false,
  };
}

/** The message shown instead of a render when the upload is not a drawing. */
export function rejectionMessage(c: SourceClassification | null): string | null {
  if (!c || c.supported) return null;
  const why =
    c.kind === "photograph"
      ? "This looks like a photograph of a real space, not a drawing."
      : "This image does not read as a sketch, plan or line drawing.";
  const detail = c.reason ? " " + c.reason : "";
  return (
    why +
    detail +
    " Sketch To Render only works from a hand sketch, floor plan, blueprint, elevation, line drawing or annotated" +
    " concept drawing. If this really is a photo of the space, use Redesign, Virtual Stage or Materials instead —" +
    " they are built for photographs. If it is a drawing, upload a flatter, higher-contrast scan and try again."
  );
}

/** Low confidence is surfaced, never silently accepted. */
export function classificationWarning(c: SourceClassification | null): string | null {
  if (!c || !c.supported) return null;
  if (c.confidence >= 0.65) return null;
  return (
    "The drawing type was read as " +
    c.label +
    " with low confidence. Confirm the type yourself before rendering so the geometry is read the right way."
  );
}

/* -------------------------------------------------------------- geometry */

export type Box = { x: number; y: number; w: number; h: number };

export type GeometryKind =
  | "wall"
  | "opening"
  | "door"
  | "window"
  | "room"
  | "fixture"
  | "furniture"
  | "dimension"
  | "label"
  | "camera";

export const GEOMETRY_KINDS: Array<{
  id: GeometryKind;
  label: string;
  plural: string;
  blurb: string;
}> = [
  { id: "wall", label: "Wall", plural: "Walls", blurb: "A structural or partition wall run." },
  { id: "opening", label: "Opening", plural: "Openings", blurb: "A cased opening, arch or pass-through." },
  { id: "door", label: "Door", plural: "Doors", blurb: "A swinging, sliding or pocket door." },
  { id: "window", label: "Window", plural: "Windows", blurb: "A window, slider or glass door." },
  { id: "room", label: "Room Boundary", plural: "Room Boundaries", blurb: "An enclosed room or area." },
  { id: "fixture", label: "Fixture", plural: "Major Fixtures", blurb: "Plumbing, cabinetry, stairs or built-ins." },
  { id: "furniture", label: "Furniture Symbol", plural: "Furniture Symbols", blurb: "A drawn furniture symbol." },
  { id: "dimension", label: "Dimension", plural: "Dimensions", blurb: "A written measurement on the drawing." },
  { id: "label", label: "Label", plural: "Labels", blurb: "Room names, notes and callouts." },
  { id: "camera", label: "Camera Marker", plural: "Camera Markers", blurb: "A view marker drawn on the plan." },
];

export function geometryKindLabel(id: string): string {
  return GEOMETRY_KINDS.find((k) => k.id === id)?.label || "Element";
}

export type GeometryItem = {
  id: string;
  kind: GeometryKind;
  label: string;
  box: Box;
  confidence: number;
  detail: string | null;
  /** Written measurement exactly as it appears, e.g. "12'-6\"". Never invented. */
  dimension: string | null;
  origin: "detected" | "user";
};

export type UnitId = "ft" | "m" | "unknown";

export type ScaleCalibration = {
  /** True only when the user calibrated or a scale note was actually read. */
  known: boolean;
  /** The reference the user measured against, e.g. "front wall". */
  reference: string | null;
  /** Real length of that reference. */
  length: number | null;
  units: UnitId;
  /** Where the calibration came from. */
  source: "user" | "drawing" | null;
};

export type SketchGeometry = {
  items: GeometryItem[];
  units: UnitId;
  scale: ScaleCalibration;
  summary: string | null;
  /** Things the reader could not resolve. Always shown to the user. */
  warnings: string[];
};

export function emptyScale(): ScaleCalibration {
  return { known: false, reference: null, length: null, units: "unknown", source: null };
}

export function emptyGeometry(): SketchGeometry {
  return { items: [], units: "unknown", scale: emptyScale(), summary: null, warnings: [] };
}

function geoKindFrom(v: unknown): GeometryKind | null {
  const raw = String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const hit = GEOMETRY_KINDS.find((k) => k.id === raw);
  if (hit) return hit.id;
  if (raw === "walls" || raw === "partition") return "wall";
  if (raw === "doorway") return "door";
  if (raw === "glazing") return "window";
  if (raw === "space" || raw === "area" || raw === "room_boundary") return "room";
  if (raw === "plumbing" || raw === "cabinet" || raw === "stairs" || raw === "appliance") return "fixture";
  if (raw === "text" || raw === "note" || raw === "callout") return "label";
  if (raw === "measurement" || raw === "dim") return "dimension";
  if (raw === "view" || raw === "viewpoint") return "camera";
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

function unitFrom(v: unknown): UnitId {
  const raw = String(v ?? "").trim().toLowerCase();
  if (raw.startsWith("ft") || raw.startsWith("feet") || raw === "imperial" || raw === "'") return "ft";
  if (raw.startsWith("m") || raw === "metric" || raw === "mm" || raw === "cm") return "m";
  return "unknown";
}

export function normalizeGeometry(raw: unknown): SketchGeometry {
  const r = (raw || {}) as Record<string, unknown>;
  const list = Array.isArray(r["elements"]) ? r["elements"] : Array.isArray(r["items"]) ? r["items"] : [];
  const items: GeometryItem[] = [];
  list.forEach((entry, i) => {
    const e = (entry || {}) as Record<string, unknown>;
    const kind = geoKindFrom(e["kind"] ?? e["type"]);
    if (!kind) return;
    items.push({
      id: String(e["id"] || kind + "-" + (i + 1)),
      kind,
      label: str(e["label"], 70) || geometryKindLabel(kind),
      box: normBox(e["box"]),
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
    items,
    units,
    /* A scale is only "known" when the drawing states one; a guess is not a scale. */
    scale: noted
      ? { known: true, reference: noted, length: null, units, source: "drawing" }
      : emptyScale(),
    summary: str(r["summary"], 400),
    warnings: (Array.isArray(r["warnings"]) ? r["warnings"] : [])
      .map((w) => str(w, 200))
      .filter((w): w is string => !!w)
      .slice(0, 8),
  };
}

export function geometryCounts(g: SketchGeometry): Record<GeometryKind, number> {
  const out = {} as Record<GeometryKind, number>;
  GEOMETRY_KINDS.forEach((k) => {
    out[k.id] = 0;
  });
  g.items.forEach((i) => {
    out[i.kind] = (out[i.kind] || 0) + 1;
  });
  return out;
}

/** Items the reader was not sure about; the user is asked to confirm these. */
export function uncertainItems(g: SketchGeometry, threshold = 0.55): GeometryItem[] {
  return g.items.filter((i) => i.origin === "detected" && i.confidence < threshold);
}

export function geometryReady(g: SketchGeometry): boolean {
  return g.items.some((i) => i.kind === "wall" || i.kind === "room");
}

export type DimensionEntry = {
  id: string;
  /** What was measured, e.g. "living room width". */
  label: string;
  value: number;
  units: UnitId;
  /** True when the user typed it, false when it was read off the drawing. */
  entered: boolean;
};

/** Honest: dimensions exist only when detected on the drawing or typed in. */
export function dimensionsKnown(g: SketchGeometry, entered: DimensionEntry[]): boolean {
  return entered.length > 0 || g.items.some((i) => !!i.dimension);
}

export function dimensionStatement(g: SketchGeometry, entered: DimensionEntry[]): string {
  const read = g.items.filter((i) => !!i.dimension);
  if (!read.length && !entered.length)
    return "No dimensions were detected and none were entered, so proportions are interpreted from the drawing only.";
  const parts: string[] = [];
  if (read.length) parts.push(read.length + " dimension" + (read.length > 1 ? "s" : "") + " read from the drawing");
  if (entered.length) parts.push(entered.length + " entered by you");
  return "Dimensions respected: " + parts.join(" and ") + ".";
}

export function scaleStatement(scale: ScaleCalibration): string {
  if (!scale.known || !scale.reference) return "No scale was calibrated; sizes are relative to the drawing.";
  const size = scale.length ? " = " + scale.length + " " + (scale.units === "m" ? "m" : "ft") : "";
  return "Scale calibrated against " + scale.reference + size + ".";
}

/* ------------------------------------------------------------ render mode */

export type RenderModeId =
  | "interior_perspective"
  | "exterior_perspective"
  | "eye_level"
  | "floor_plan_3d_furnished"
  | "floor_plan_3d_unfurnished"
  | "elevation_render";

export type RenderMode = {
  id: RenderModeId;
  label: string;
  blurb: string;
  needsCamera: boolean;
  furnished: boolean | null;
  /** Instruction fragment that describes the view to the model. */
  rule: string;
};

export const RENDER_MODES: RenderMode[] = [
  {
    id: "interior_perspective",
    label: "Interior Perspective",
    blurb: "A room seen from inside, from the camera you place.",
    needsCamera: true,
    furnished: true,
    rule:
      "Render an interior perspective photograph taken from the camera position given below, looking in the stated" +
      " direction with the stated eye height and field of view.",
  },
  {
    id: "exterior_perspective",
    label: "Exterior Perspective",
    blurb: "The building seen from outside.",
    needsCamera: true,
    furnished: null,
    rule:
      "Render an exterior architectural photograph of the building from the camera position given below, keeping the" +
      " drawn massing, roof lines and opening positions.",
  },
  {
    id: "eye_level",
    label: "Eye-Level Render",
    blurb: "A standing-height view, as a person would see it.",
    needsCamera: true,
    furnished: true,
    rule:
      "Render a natural eye-level photograph from the camera position given below, with a level horizon and no tilt," +
      " as a person standing in the space would see it.",
  },
  {
    id: "floor_plan_3d_furnished",
    label: "Furnished 3D Floor Plan",
    blurb: "A dollhouse view of the whole plan, furnished.",
    needsCamera: false,
    furnished: true,
    rule:
      "Render a 3D dollhouse floor plan of the whole layout seen from above at roughly 45 degrees, walls cut down," +
      " every room furnished to scale.",
  },
  {
    id: "floor_plan_3d_unfurnished",
    label: "Unfurnished 3D Floor Plan",
    blurb: "A dollhouse view of the whole plan, empty.",
    needsCamera: false,
    furnished: false,
    rule:
      "Render a 3D dollhouse floor plan of the whole layout seen from above at roughly 45 degrees, walls cut down," +
      " with finished floors but no furniture at all.",
  },
  {
    id: "elevation_render",
    label: "Elevation Render",
    blurb: "A straight-on rendered facade or wall.",
    needsCamera: false,
    furnished: null,
    rule:
      "Render a straight-on elevation with no perspective convergence: the facade or wall is parallel to the image" +
      " plane, openings stay in their drawn positions and proportions.",
  },
];

export const DEFAULT_RENDER_MODE: RenderModeId = "interior_perspective";

export function renderMode(id?: string | null): RenderMode {
  return RENDER_MODES.find((m) => m.id === id) || RENDER_MODES[0]!;
}

/** Which modes make sense for the confirmed drawing type. */
export function modesForKind(kind: SketchKindId): RenderModeId[] {
  if (kind === "elevation") return ["elevation_render", "exterior_perspective", "eye_level"];
  if (kind === "floor_plan" || kind === "blueprint")
    return [
      "floor_plan_3d_furnished",
      "floor_plan_3d_unfurnished",
      "interior_perspective",
      "eye_level",
      "exterior_perspective",
      "elevation_render",
    ];
  return ["interior_perspective", "eye_level", "exterior_perspective", "floor_plan_3d_furnished", "elevation_render"];
}

/* ---------------------------------------------------------------- camera */

export type CameraMarker = {
  id: string;
  /** Position on the drawing, normalized 0..1 from the top-left. */
  x: number;
  y: number;
  /** Compass-style heading in degrees, 0 = up the drawing. */
  direction: number;
  /** Eye height, in the drawing's units. Approximate by definition. */
  height: number;
  /** Horizontal field of view in degrees. */
  fov: number;
  label: string;
};

export const DEFAULT_EYE_HEIGHT_FT = 5.4;

export const FOV_CHOICES: Array<{ id: string; label: string; fov: number; blurb: string }> = [
  { id: "tight", label: "35mm", fov: 54, blurb: "Tight, natural." },
  { id: "standard", label: "24mm", fov: 74, blurb: "Standard real estate." },
  { id: "wide", label: "18mm", fov: 90, blurb: "Wide, shows the whole room." },
];

export function cameraMarker(partial: Partial<CameraMarker> & { id: string }): CameraMarker {
  return {
    id: partial.id,
    x: clamp01(partial.x ?? 0.5),
    y: clamp01(partial.y ?? 0.75),
    direction: clamp(num(partial.direction, 0), 0, 359),
    height: clamp(num(partial.height, DEFAULT_EYE_HEIGHT_FT), 1, 30),
    fov: clamp(num(partial.fov, 74), 20, 120),
    label: String(partial.label || "View 1").slice(0, 40),
  };
}

export function directionLabel(deg: number): string {
  const d = ((num(deg, 0) % 360) + 360) % 360;
  const names = ["up the plan", "up and right", "right", "down and right", "down the plan", "down and left", "left", "up and left"];
  return names[Math.round(d / 45) % 8] as string;
}

export function cameraSentence(c: CameraMarker, units: UnitId): string {
  const u = units === "m" ? "m" : "ft";
  return (
    c.label +
    ": standing at " +
    Math.round(c.x * 100) +
    "% across and " +
    Math.round(c.y * 100) +
    "% down the drawing, facing " +
    directionLabel(c.direction) +
    " (" +
    Math.round(c.direction) +
    "°), eye height about " +
    c.height +
    u +
    ", " +
    Math.round(c.fov) +
    "° field of view"
  );
}

/* ---------------------------------------------------------- look settings */

export const FURNITURE_LEVELS: Array<{ id: string; label: string; rule: string }> = [
  { id: "empty", label: "Empty", rule: "Leave the space unfurnished; show finishes and light only." },
  { id: "minimal", label: "Minimal", rule: "Place only the essential pieces, generously spaced." },
  { id: "balanced", label: "Balanced", rule: "Furnish the space normally for its use, leaving clear circulation." },
  { id: "full", label: "Fully Furnished", rule: "Furnish completely, including rugs, lighting and accessories." },
];

export const FINISH_GRADES: Array<{ id: string; label: string; rule: string }> = [
  { id: "builder", label: "Builder Grade", rule: "Standard builder finishes and volume-market fixtures." },
  { id: "retail", label: "Retail Grade", rule: "Mid-market retail finishes; clean, current, unremarkable." },
  { id: "designer", label: "Designer Grade", rule: "Specified designer finishes with considered detailing." },
  { id: "luxury", label: "Luxury Grade", rule: "High-end natural materials, custom millwork and integrated lighting." },
];

export const MATERIAL_DIRECTIONS: Array<{ id: string; label: string; rule: string }> = [
  { id: "auto", label: "Follow The Style", rule: "Use the materials the chosen style implies." },
  { id: "warm_wood", label: "Warm Wood", rule: "Warm oak and walnut tones, soft matte paint, brushed brass." },
  { id: "light_airy", label: "Light & Airy", rule: "Pale oak, white walls, light stone, matte black hardware." },
  { id: "stone_concrete", label: "Stone & Concrete", rule: "Honed stone, micro-cement, dark metal, restrained palette." },
  { id: "moody", label: "Moody", rule: "Deep paint colours, dark timber, aged brass, layered lighting." },
  { id: "coastal", label: "Coastal", rule: "White oak, linen, chalk plaster, soft blues and sand tones." },
];

function ruleOf(list: Array<{ id: string; label: string; rule: string }>, id: string | null | undefined, fallback: string) {
  return list.find((x) => x.id === id) || list.find((x) => x.id === fallback) || list[0]!;
}

/* ------------------------------------------------------------ geometry lock */

export const GEOMETRY_LOCK_RULES: string[] = [
  "Preserve every wall relationship: walls that meet in the drawing meet in the render, at the same relative angles.",
  "Preserve every opening position: doors, windows and cased openings stay on the same wall, in the same order and at the same relative position along that wall.",
  "Preserve room adjacencies: rooms that share a wall in the drawing share a wall in the render.",
  "Respect every dimension that was supplied, and never imply a dimension that was not.",
  "Keep fixed plumbing fixtures where they are drawn; sinks, toilets, tubs, showers and kitchen runs do not move.",
  "Do not add rooms, hallways, levels or structures that are not in the drawing.",
  "Do not drop or hide any detected opening.",
  "No impossible doors: every door must swing into real clear space and must not open into a wall, a counter or another door.",
  "No contradictory furniture scale: furniture must be plausible against the wall lengths and openings shown.",
];

export type SketchPayload = {
  source_kind: SketchKindId;
  source_label: string;
  mode: RenderModeId;
  mode_label: string;
  mode_rule: string;
  room_type: string | null;
  style_id: string | null;
  style_name: string | null;
  material_direction: string;
  material_label: string;
  material_rule: string;
  furniture_level: string;
  furniture_label: string;
  furniture_rule: string;
  finish_grade: string;
  finish_label: string;
  finish_rule: string;
  units: UnitId;
  scale: ScaleCalibration;
  dimensions: DimensionEntry[];
  dimensions_known: boolean;
  camera: CameraMarker | null;
  cameras: CameraMarker[];
  geometry: Array<{
    id: string;
    kind: GeometryKind;
    label: string;
    box: Box;
    dimension: string | null;
    detail: string | null;
    origin: "detected" | "user";
  }>;
  geometry_summary: string | null;
  uncertain: string[];
  notes: string | null;
  /** Stable id for one interpreted scene, shared by every view of it. */
  scene_id: string;
  /** Views already rendered from this scene, so materials stay consistent. */
  continuity: Array<{ mode: RenderModeId; label: string; camera: string | null }>;
  disclaimer: string;
};

export type SketchRun = { id: string; label: string; directive: string };

export type SketchBrief = {
  valid: boolean;
  missing: string[];
  warnings: string[];
  lines: Array<{ k: string; v: string }>;
  payload: SketchPayload;
  runs: SketchRun[];
  credits: number;
  costSentence: string;
  disclaimer: string;
};

export type SketchSettings = {
  classification: SourceClassification | null;
  geometry: SketchGeometry;
  mode: RenderModeId;
  cameras: CameraMarker[];
  activeCameraId: string | null;
  roomType: string | null;
  styleId: string | null;
  styleName: string | null;
  materialDirection: string;
  furnitureLevel: string;
  finishGrade: string;
  units: UnitId;
  dimensions: DimensionEntry[];
  scale: ScaleCalibration;
  notes: string | null;
  results: number;
  sceneId: string | null;
  continuity: Array<{ mode: RenderModeId; label: string; camera: string | null }>;
  hasSource: boolean;
};

export function sketchCredits(results: number): number {
  return Math.max(1, Math.min(4, Math.round(num(results, 1)))) * CREDITS_PER_RESULT;
}

export function costSentence(results: number): string {
  const n = Math.max(1, Math.min(4, Math.round(num(results, 1))));
  return n === 1
    ? "One render, one credit. Nothing is charged until you confirm."
    : n + " renders, " + n + " credits. A render that fails is refunded automatically.";
}

export function newSceneId(): string {
  return "scene-" + Math.random().toString(36).slice(2, 10);
}

const VIEW_RUNS: Array<{ id: string; label: string; directive: string }> = [
  { id: "primary", label: "Primary View", directive: "" },
  {
    id: "alt_light",
    label: "Alternate Light",
    directive: "Same geometry, same materials and same furniture; change only the time of day and light quality.",
  },
  {
    id: "alt_material",
    label: "Alternate Materials",
    directive:
      "Same geometry, same camera and same furniture layout; shift the material palette within the chosen style.",
  },
  {
    id: "alt_furniture",
    label: "Alternate Furniture",
    directive: "Same geometry, same camera and same materials; rearrange the furniture into a second workable layout.",
  },
];

export function buildRuns(results: number): SketchRun[] {
  const n = Math.max(1, Math.min(4, Math.round(num(results, 1))));
  return VIEW_RUNS.slice(0, n);
}

/**
 * Assembles everything the user has set into one brief. The brief is the only
 * thing allowed to authorize a charge, so it fails loudly rather than guessing.
 */
export function buildSketchBrief(input: SketchSettings): SketchBrief {
  const missing: string[] = [];
  const warnings: string[] = [];
  const cls = input.classification;
  const mode = renderMode(input.mode);
  const kind = sketchKind(cls?.kind);

  if (!input.hasSource) missing.push("Upload a sketch, plan or line drawing first");
  if (!cls) missing.push("Classify the drawing before rendering");
  else if (!cls.supported) missing.push("This image is not a drawing we can render");
  else if (!cls.confirmed) missing.push("Confirm the drawing type");

  if (!geometryReady(input.geometry)) missing.push("Review the detected geometry before rendering");

  const cameras = (input.cameras || []).map((c) => cameraMarker(c));
  const active = cameras.find((c) => c.id === input.activeCameraId) || cameras[0] || null;
  if (mode.needsCamera && !active) missing.push("Place a camera on the drawing for this view");

  if (!modesForKind(kind.id).includes(mode.id))
    warnings.push(
      mode.label + " is an unusual choice for a " + kind.label.toLowerCase() + "; the result may be interpreted loosely.",
    );

  const uncertain = uncertainItems(input.geometry);
  if (uncertain.length)
    warnings.push(
      uncertain.length +
        " detected element" +
        (uncertain.length > 1 ? "s were" : " was") +
        " read with low confidence: " +
        uncertain
          .slice(0, 4)
          .map((u) => u.label)
          .join(", ") +
        ". Correct or remove anything wrong first.",
    );
  input.geometry.warnings.forEach((w) => warnings.push(w));

  const known = dimensionsKnown(input.geometry, input.dimensions);
  if (!known)
    warnings.push(
      "No dimensions were detected or entered, so sizes in the render are proportional guesses, not measurements.",
    );
  if (!input.scale.known)
    warnings.push("No scale is calibrated. Enter one known length to make furniture and openings scale honestly.");

  const material = ruleOf(MATERIAL_DIRECTIONS, input.materialDirection, "auto");
  const furniture = ruleOf(
    FURNITURE_LEVELS,
    mode.furnished === false ? "empty" : input.furnitureLevel,
    "balanced",
  );
  const finish = ruleOf(FINISH_GRADES, input.finishGrade, "retail");

  const payload: SketchPayload = {
    source_kind: kind.id,
    source_label: kind.label,
    mode: mode.id,
    mode_label: mode.label,
    mode_rule: mode.rule,
    room_type: input.roomType || null,
    style_id: input.styleId || null,
    style_name: input.styleName || null,
    material_direction: material.id,
    material_label: material.label,
    material_rule: material.rule,
    furniture_level: furniture.id,
    furniture_label: furniture.label,
    furniture_rule: furniture.rule,
    finish_grade: finish.id,
    finish_label: finish.label,
    finish_rule: finish.rule,
    units: input.units,
    scale: input.scale,
    dimensions: input.dimensions.slice(0, 24),
    dimensions_known: known,
    camera: mode.needsCamera ? active : null,
    cameras,
    geometry: input.geometry.items.map((i) => ({
      id: i.id,
      kind: i.kind,
      label: i.label,
      box: i.box,
      dimension: i.dimension,
      detail: i.detail,
      origin: i.origin,
    })),
    geometry_summary: input.geometry.summary,
    uncertain: uncertain.map((u) => u.label),
    notes: input.notes && input.notes.trim() ? input.notes.trim().slice(0, 600) : null,
    scene_id: input.sceneId || newSceneId(),
    continuity: (input.continuity || []).slice(0, 8),
    disclaimer: CONCEPT_DISCLAIMER,
  };

  const counts = geometryCounts(input.geometry);
  const lines: Array<{ k: string; v: string }> = [
    { k: "Source", v: kind.label },
    { k: "Render Mode", v: mode.label },
    {
      k: "Geometry",
      v:
        [
          counts.wall ? counts.wall + " walls" : "",
          counts.room ? counts.room + " rooms" : "",
          counts.door ? counts.door + " doors" : "",
          counts.window ? counts.window + " windows" : "",
          counts.opening ? counts.opening + " openings" : "",
          counts.fixture ? counts.fixture + " fixtures" : "",
        ]
          .filter(Boolean)
          .join(", ") || "Nothing detected yet",
    },
    { k: "Dimensions", v: dimensionStatement(input.geometry, input.dimensions) },
    { k: "Scale", v: scaleStatement(input.scale) },
  ];
  if (payload.camera) lines.push({ k: "Camera", v: cameraSentence(payload.camera, input.units) });
  if (payload.room_type) lines.push({ k: "Room", v: payload.room_type });
  if (payload.style_name) lines.push({ k: "Style", v: payload.style_name });
  lines.push({ k: "Materials", v: material.label });
  lines.push({ k: "Furniture", v: furniture.label });
  lines.push({ k: "Finish", v: finish.label });
  if (payload.continuity.length)
    lines.push({
      k: "Continuity",
      v: "Matches " + payload.continuity.map((c) => c.label).join(", ") + " from this same interpreted plan.",
    });
  if (payload.notes) lines.push({ k: "Your Instructions", v: payload.notes });

  const runs = buildRuns(input.results);
  return {
    valid: missing.length === 0,
    missing,
    warnings,
    lines,
    payload,
    runs,
    credits: sketchCredits(runs.length),
    costSentence: costSentence(runs.length),
    disclaimer: CONCEPT_DISCLAIMER,
  };
}

/* ---------------------------------------------------------------- prompt */

function boxSentence(b: Box): string {
  const pct = (n: number) => Math.round(n * 100) + "%";
  return "x " + pct(b.x) + "–" + pct(b.x + b.w) + ", y " + pct(b.y) + "–" + pct(b.y + b.h);
}

/**
 * The generation request. The original drawing is attached separately; this
 * text carries the structured geometry, so the model is never asked to
 * re-read the plan for itself.
 */
export function sketchPrompt(payload: SketchPayload, run: SketchRun | null): string {
  const lines: string[] = [];
  lines.push(
    "You are producing a believable architectural visualization from an uploaded " +
      payload.source_label.toLowerCase() +
      ". The attached image is the drawing. The structured geometry below is authoritative: it was detected from that" +
      " drawing and corrected by the user, and it overrides anything you think you see.",
  );
  lines.push("", payload.mode_rule);

  lines.push("", "GEOMETRY THAT MUST BE PRESERVED");
  if (!payload.geometry.length) lines.push("- No structured geometry was supplied; follow the drawing literally.");
  const byKind = new Map<GeometryKind, typeof payload.geometry>();
  payload.geometry.forEach((g) => {
    const arr = byKind.get(g.kind) || [];
    arr.push(g);
    byKind.set(g.kind, arr);
  });
  GEOMETRY_KINDS.forEach((k) => {
    const arr = byKind.get(k.id);
    if (!arr || !arr.length) return;
    lines.push(k.plural + ":");
    arr.forEach((g) =>
      lines.push(
        "- " +
          g.label +
          " at " +
          boxSentence(g.box) +
          (g.dimension ? ", labelled " + g.dimension : "") +
          (g.detail ? " — " + g.detail : "") +
          (g.origin === "user" ? " (added by the user)" : ""),
      ),
    );
  });
  if (payload.geometry_summary) lines.push("", "Reader's summary of the plan: " + payload.geometry_summary);

  lines.push("", "GEOMETRY LOCK");
  GEOMETRY_LOCK_RULES.forEach((r) => lines.push("- " + r));

  lines.push("", "DIMENSIONS AND SCALE");
  if (payload.dimensions.length) {
    payload.dimensions.forEach((d) =>
      lines.push("- " + d.label + ": " + d.value + " " + (d.units === "m" ? "m" : "ft") + (d.entered ? " (entered by the user)" : " (read from the drawing)")),
    );
  } else {
    lines.push(
      "- No dimensions were supplied. Keep proportions consistent with the drawing and do not imply exact sizes.",
    );
  }
  lines.push("- " + scaleStatement(payload.scale));

  if (payload.camera) {
    lines.push("", "CAMERA");
    lines.push("- " + cameraSentence(payload.camera, payload.units));
    lines.push("- Keep the horizon level and verticals vertical; no dutch tilt, no fisheye distortion.");
  }

  lines.push("", "LOOK");
  if (payload.room_type) lines.push("- Room: " + payload.room_type + ".");
  if (payload.style_name) lines.push("- Style: " + payload.style_name + ".");
  lines.push("- Materials: " + payload.material_rule);
  lines.push("- Furniture: " + payload.furniture_rule);
  lines.push("- Finish level: " + payload.finish_rule);
  lines.push(
    "- Light the space naturally through the windows that actually exist in the geometry above, and nowhere else.",
  );

  if (payload.continuity.length) {
    lines.push("", "CONTINUITY");
    lines.push(
      "- This is another view of the same interpreted plan (" +
        payload.scene_id +
        "). Reuse the exact same materials, finishes, colours and furniture pieces as: " +
        payload.continuity.map((c) => c.label + (c.camera ? " (" + c.camera + ")" : "")).join("; ") +
        ".",
    );
    lines.push("- Do not redesign rooms that are not the subject of this view; they must read as the same home.");
  }

  if (payload.uncertain.length)
    lines.push(
      "",
      "The user flagged these as uncertain in the drawing: " +
        payload.uncertain.join(", ") +
        ". Interpret them conservatively rather than inventing detail.",
    );

  if (payload.notes) lines.push("", "The user also asks: " + payload.notes);
  if (run?.directive) lines.push("", "For this option: " + run.directive);

  lines.push(
    "",
    "Output one photorealistic image only. This is a concept visualization, not a construction document: never add" +
      " dimension lines, scale bars, north arrows, stamps or text of any kind to the image.",
  );
  return lines.join("\n");
}

/* ------------------------------------------------------------ drift check */

export type DriftCheckId =
  | "missing_opening"
  | "extra_room"
  | "moved_wall"
  | "adjacency_broken"
  | "impossible_door"
  | "fixture_moved"
  | "scale_wrong"
  | "wrong_view";

export const DRIFT_CHECKS: Array<{ id: DriftCheckId; label: string; question: string }> = [
  {
    id: "missing_opening",
    label: "Missing Opening",
    question: "Is any door, window or cased opening from the drawing absent in the render?",
  },
  { id: "extra_room", label: "Extra Space", question: "Does the render show a room, level or structure the drawing does not have?" },
  { id: "moved_wall", label: "Moved Wall", question: "Has a wall moved, disappeared or changed angle relative to the drawing?" },
  {
    id: "adjacency_broken",
    label: "Broken Adjacency",
    question: "Do two rooms that share a wall in the drawing fail to share one in the render?",
  },
  { id: "impossible_door", label: "Impossible Door", question: "Does any door open into a wall, a counter or another door?" },
  { id: "fixture_moved", label: "Fixture Moved", question: "Has a fixed plumbing fixture or kitchen run moved from where it is drawn?" },
  { id: "scale_wrong", label: "Scale Conflict", question: "Is any furniture or opening obviously the wrong size for the walls around it?" },
  { id: "wrong_view", label: "Wrong View", question: "Does the view fail to match the requested render mode or camera?" },
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
  const ids = DRIFT_CHECKS.map((c) => c.id);
  const issues: DriftIssue[] = [];
  list.forEach((entry) => {
    const e = (entry || {}) as Record<string, unknown>;
    const id = String(e["id"] || "") as DriftCheckId;
    if (!ids.includes(id)) return;
    const detail = str(e["detail"], 220);
    if (!detail) return;
    issues.push({ id, severity: e["severity"] === "major" ? "major" : "minor", detail });
  });
  return summarizeDrift(issues);
}

export function summarizeDrift(issues: DriftIssue[]): DriftReport {
  const major = issues.some((i) => i.severity === "major");
  const headline = !issues.length
    ? "The render follows the uploaded geometry."
    : major
      ? "Major drift from your drawing"
      : "Small differences from your drawing";
  return { issues, major, headline, disclaimer: CONCEPT_DISCLAIMER };
}

/* --------------------------------------------------------- plan export */

/** A plain-text export of exactly what the tool believes the drawing says. */
export function exportPlanText(
  geometry: SketchGeometry,
  meta: { kind: SketchKindId; dimensions: DimensionEntry[]; cameras: CameraMarker[]; units: UnitId },
): string {
  const lines: string[] = [];
  lines.push("REAL DESIGNS — INTERPRETED PLAN");
  lines.push(CONCEPT_DISCLAIMER);
  lines.push("Generated " + new Date().toISOString());
  lines.push("");
  lines.push("Source type: " + sketchKindLabel(meta.kind));
  lines.push("Units: " + (meta.units === "unknown" ? "not stated" : meta.units));
  lines.push(scaleStatement(geometry.scale));
  lines.push(dimensionStatement(geometry, meta.dimensions));
  if (geometry.summary) lines.push("Summary: " + geometry.summary);
  lines.push("");
  GEOMETRY_KINDS.forEach((k) => {
    const items = geometry.items.filter((i) => i.kind === k.id);
    if (!items.length) return;
    lines.push(k.plural.toUpperCase());
    items.forEach((i) =>
      lines.push(
        "- " +
          i.label +
          " [" +
          boxSentence(i.box) +
          "]" +
          (i.dimension ? " " + i.dimension : "") +
          (i.detail ? " — " + i.detail : "") +
          (i.origin === "user" ? " (user)" : " (" + Math.round(i.confidence * 100) + "% confidence)"),
      ),
    );
    lines.push("");
  });
  if (meta.dimensions.length) {
    lines.push("DIMENSIONS");
    meta.dimensions.forEach((d) =>
      lines.push("- " + d.label + ": " + d.value + " " + d.units + (d.entered ? " (entered)" : " (read)")),
    );
    lines.push("");
  }
  if (meta.cameras.length) {
    lines.push("CAMERAS");
    meta.cameras.forEach((c) => lines.push("- " + cameraSentence(c, meta.units)));
    lines.push("");
  }
  if (geometry.warnings.length) {
    lines.push("UNRESOLVED");
    geometry.warnings.forEach((w) => lines.push("- " + w));
  }
  return lines.join("\n");
}

/* ---------------------------------------------------------- persistence */

export type SketchMeta = {
  tool: "Sketch";
  classification: string;
  source_kind: SketchKindId;
  scene_id: string;
  mode: RenderModeId;
  mode_label: string;
  camera: CameraMarker | null;
  cameras: CameraMarker[];
  geometry: SketchPayload["geometry"];
  geometry_summary: string | null;
  units: UnitId;
  scale: ScaleCalibration;
  dimensions: DimensionEntry[];
  dimensions_known: boolean;
  style_id: string | null;
  style_name: string | null;
  material_direction: string;
  furniture_level: string;
  finish_grade: string;
  room_type: string | null;
  instructions: string | null;
  continuity: SketchPayload["continuity"];
  drift: DriftIssue[];
  source_version: string | null;
  run: string;
  model: string;
  disclaimer: string;
  at: string;
};

export const SKETCH_CLASSIFICATION = "Concept Render";

export function sketchMeta(input: {
  payload: SketchPayload;
  sourceVersion: string | null;
  run: string;
  model?: string;
  drift?: DriftIssue[];
}): SketchMeta {
  const p = input.payload;
  return {
    tool: "Sketch",
    classification: SKETCH_CLASSIFICATION,
    source_kind: p.source_kind,
    scene_id: p.scene_id,
    mode: p.mode,
    mode_label: renderMode(p.mode).label,
    camera: p.camera,
    cameras: p.cameras,
    geometry: p.geometry,
    geometry_summary: p.geometry_summary,
    units: p.units,
    scale: p.scale,
    dimensions: p.dimensions,
    dimensions_known: p.dimensions_known,
    style_id: p.style_id,
    style_name: p.style_name,
    material_direction: p.material_direction,
    furniture_level: p.furniture_level,
    finish_grade: p.finish_grade,
    room_type: p.room_type,
    instructions: p.notes,
    continuity: p.continuity,
    drift: input.drift || [],
    source_version: input.sourceVersion,
    run: input.run,
    model: input.model || "google/gemini-2.5-flash-image",
    disclaimer: CONCEPT_DISCLAIMER,
    at: new Date().toISOString(),
  };
}

export type RestoredSketch = {
  classification: SourceClassification;
  geometry: SketchGeometry;
  mode: RenderModeId;
  cameras: CameraMarker[];
  activeCameraId: string | null;
  units: UnitId;
  scale: ScaleCalibration;
  dimensions: DimensionEntry[];
  materialDirection: string;
  furnitureLevel: string;
  finishGrade: string;
  roomType: string | null;
  notes: string | null;
  sceneId: string;
  continuity: SketchPayload["continuity"];
};

/** Rehydrates the panel from a saved version so a scene reopens intact. */
export function restoreFromMeta(meta: unknown): RestoredSketch | null {
  const m = (meta || {}) as Record<string, unknown>;
  if (!m || m["tool"] !== "Sketch") return null;
  const kind = kindFrom(m["source_kind"]) || "hand_sketch";
  const items = (Array.isArray(m["geometry"]) ? m["geometry"] : []).map((raw, i) => {
    const g = (raw || {}) as Record<string, unknown>;
    const k = geoKindFrom(g["kind"]) || "wall";
    return {
      id: String(g["id"] || k + "-" + (i + 1)),
      kind: k,
      label: str(g["label"], 70) || geometryKindLabel(k),
      box: normBox(g["box"]),
      confidence: 1,
      detail: str(g["detail"], 180),
      dimension: str(g["dimension"], 40),
      origin: g["origin"] === "user" ? ("user" as const) : ("detected" as const),
    };
  });
  const cameras = (Array.isArray(m["cameras"]) ? m["cameras"] : []).map((c, i) =>
    cameraMarker({ ...(c as object), id: String((c as any)?.id || "cam" + (i + 1)) } as any),
  );
  const scaleRaw = (m["scale"] || {}) as Record<string, unknown>;
  const units = unitFrom(m["units"]);
  return {
    classification: {
      kind,
      label: sketchKindLabel(kind),
      confidence: 1,
      summary: str(m["geometry_summary"], 300),
      reason: null,
      supported: sketchKind(kind).supported,
      alternatives: [],
      confirmed: true,
    },
    geometry: {
      items,
      units,
      scale: {
        known: !!scaleRaw["known"],
        reference: str(scaleRaw["reference"], 120),
        length: scaleRaw["length"] == null ? null : num(scaleRaw["length"], 0),
        units: unitFrom(scaleRaw["units"]),
        source: scaleRaw["source"] === "user" ? "user" : scaleRaw["source"] === "drawing" ? "drawing" : null,
      },
      summary: str(m["geometry_summary"], 400),
      warnings: [],
    },
    mode: renderMode(m["mode"] as string).id,
    cameras,
    activeCameraId: (m["camera"] as any)?.id || cameras[0]?.id || null,
    units,
    scale: {
      known: !!scaleRaw["known"],
      reference: str(scaleRaw["reference"], 120),
      length: scaleRaw["length"] == null ? null : num(scaleRaw["length"], 0),
      units: unitFrom(scaleRaw["units"]),
      source: scaleRaw["source"] === "user" ? "user" : scaleRaw["source"] === "drawing" ? "drawing" : null,
    },
    dimensions: (Array.isArray(m["dimensions"]) ? m["dimensions"] : []).map((raw, i) => {
      const d = (raw || {}) as Record<string, unknown>;
      return {
        id: String(d["id"] || "dim" + (i + 1)),
        label: str(d["label"], 60) || "Dimension",
        value: num(d["value"], 0),
        units: unitFrom(d["units"]),
        entered: d["entered"] !== false,
      };
    }),
    materialDirection: String(m["material_direction"] || "auto"),
    furnitureLevel: String(m["furniture_level"] || "balanced"),
    finishGrade: String(m["finish_grade"] || "retail"),
    roomType: str(m["room_type"], 60),
    notes: str(m["instructions"], 600),
    sceneId: String(m["scene_id"] || newSceneId()),
    continuity: (Array.isArray(m["continuity"]) ? m["continuity"] : []) as SketchPayload["continuity"],
  };
}
