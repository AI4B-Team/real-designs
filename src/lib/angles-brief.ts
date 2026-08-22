/**
 * Angles engine.
 *
 * Everything that decides what an angle set costs, what the camera is told to
 * do, what must stay identical across views, and how honest the result has to
 * be about inferred geometry lives here. The panel, the server and the tests
 * all read this one file, so a camera the user selected is literally the
 * camera the model is instructed to move to.
 *
 * The promise this file has to keep:
 * "Generate coordinated views of the same room or design from selected camera
 *  positions while maintaining visual continuity."
 */

export const ANGLES_PROMISE =
  "Generate coordinated views of the same room or design from selected camera positions while maintaining visual continuity.";

/** The exact wording that must appear whenever unseen geometry is invented. */
export const INFERENCE_DISCLOSURE =
  "Areas outside the original photograph are AI-inferred and may not reflect the actual property.";

export const CREDITS_PER_ANGLE = 1;

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

function str(v: unknown, max = 200): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/* ------------------------------------------------------------- sources */

export type AngleSourceId =
  | "generated"
  | "staged"
  | "sketch_render"
  | "saved_version"
  | "photograph";

export type AngleSourceFidelity = "structured" | "generated" | "photograph";

export type AngleSource = {
  id: AngleSourceId;
  label: string;
  fidelity: AngleSourceFidelity;
  /** Higher is a better base for coordinated views. */
  rank: number;
  blurb: string;
  /** True when unseen areas have to be disclosed as inferred. */
  infers: boolean;
};

export const ANGLE_SOURCES: AngleSource[] = [
  {
    id: "sketch_render",
    label: "Sketch-Derived Room",
    fidelity: "structured",
    rank: 4,
    blurb: "Built from drawn geometry, so unseen walls follow a real plan.",
    infers: false,
  },
  {
    id: "generated",
    label: "Generated Design",
    fidelity: "generated",
    rank: 3,
    blurb: "The design brief and style are known, so views stay coordinated.",
    infers: false,
  },
  {
    id: "staged",
    label: "Staged Design",
    fidelity: "generated",
    rank: 3,
    blurb: "Furniture and placement are known from the staging brief.",
    infers: false,
  },
  {
    id: "saved_version",
    label: "Saved Version",
    fidelity: "generated",
    rank: 2,
    blurb: "Reuses the stored brief and metadata of an earlier result.",
    infers: false,
  },
  {
    id: "photograph",
    label: "Uploaded Photograph",
    fidelity: "photograph",
    rank: 1,
    blurb: "Only what the lens saw is verified. Everything else is inferred.",
    infers: true,
  },
];

export function angleSource(id?: string | null): AngleSource {
  return ANGLE_SOURCES.find((s) => s.id === id) || ANGLE_SOURCES[ANGLE_SOURCES.length - 1]!;
}

export function sourceNeedsDisclosure(id?: string | null): boolean {
  return angleSource(id).infers;
}

export function sourceQualityNote(id?: string | null): string {
  const s = angleSource(id);
  if (s.rank >= 3) return "Best results: " + s.label + " keeps every view on one design.";
  if (s.rank === 2) return s.label + " carries its saved brief into every new view.";
  return "A single photograph shows one side of the room. Other sides are inferred, not verified.";
}

/* ------------------------------------------------------------- cameras */

export type CameraPresetId =
  | "slight_left"
  | "slight_right"
  | "wider"
  | "closer"
  | "opposite_corner"
  | "doorway"
  | "eye_level_center"
  | "custom";

export type CameraPreset = {
  id: CameraPresetId;
  label: string;
  icon: string;
  blurb: string;
  /** What the renderer is told to do with the camera. */
  directive: string;
  /** True when the view necessarily shows walls the source never saw. */
  showsUnseen: boolean;
};

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: "slight_left",
    label: "Slight Left",
    icon: "arrow-left",
    blurb: "Same spot, camera swung about 20 degrees to the left.",
    directive:
      "Move the camera about 20 degrees to the left around the same standing position, keeping the same eye height and the same lens.",
    showsUnseen: false,
  },
  {
    id: "slight_right",
    label: "Slight Right",
    icon: "arrow-right",
    blurb: "Same spot, camera swung about 20 degrees to the right.",
    directive:
      "Move the camera about 20 degrees to the right around the same standing position, keeping the same eye height and the same lens.",
    showsUnseen: false,
  },
  {
    id: "wider",
    label: "Wider View",
    icon: "maximize",
    blurb: "Step back for more of the room in frame.",
    directive:
      "Step the camera back about four feet and widen the lens so more of the same room is in frame. Do not add rooms or square footage that do not exist.",
    showsUnseen: true,
  },
  {
    id: "closer",
    label: "Closer View",
    icon: "minimize",
    blurb: "Step in on the main seating or feature area.",
    directive:
      "Step the camera about four feet forward toward the main feature of the room, keeping the same eye height and framing that feature squarely.",
    showsUnseen: false,
  },
  {
    id: "opposite_corner",
    label: "Opposite Corner",
    icon: "corner-up-left",
    blurb: "Shoot back from the far corner of the same room.",
    directive:
      "Place the camera in the opposite corner of the same room looking back toward where the original camera stood, at the same eye height.",
    showsUnseen: true,
  },
  {
    id: "doorway",
    label: "Doorway View",
    icon: "door-open",
    blurb: "The view a buyer gets walking in.",
    directive:
      "Place the camera in the main doorway of the same room looking in, at the same eye height, as a person would see the room on entering.",
    showsUnseen: true,
  },
  {
    id: "eye_level_center",
    label: "Eye-Level Center",
    icon: "scan-eye",
    blurb: "Level, centered, no tilt. The MLS standard.",
    directive:
      "Place the camera at the centre of the room at about five feet four inches, perfectly level with no upward or downward tilt and vertical lines straight.",
    showsUnseen: false,
  },
  {
    id: "custom",
    label: "Custom Camera",
    icon: "sliders-horizontal",
    blurb: "Set the direction, rotation, position, height and lens yourself.",
    directive: "",
    showsUnseen: true,
  },
];

export function cameraPreset(id?: string | null): CameraPreset {
  return CAMERA_PRESETS.find((c) => c.id === id) || CAMERA_PRESETS[0]!;
}

export type CameraDirection = "left" | "right" | "up" | "down";

export type CustomCamera = {
  direction: CameraDirection;
  /** Degrees of rotation in that direction. */
  rotation: number;
  /** Feet forward (positive) or backward (negative) from the source position. */
  dolly: number;
  /** Approximate eye height in feet. */
  height: number;
  /** Horizontal field of view in degrees. */
  fov: number;
};

export const DEFAULT_CUSTOM_CAMERA: CustomCamera = {
  direction: "left",
  rotation: 30,
  dolly: 0,
  height: 5.4,
  fov: 75,
};

export const FOV_CHOICES: Array<{ id: string; label: string; fov: number; blurb: string }> = [
  { id: "tight", label: "Tight", fov: 50, blurb: "Detail shot, little distortion." },
  { id: "natural", label: "Natural", fov: 65, blurb: "Close to how the eye reads the room." },
  { id: "listing", label: "Listing", fov: 75, blurb: "The usual real-estate framing." },
  { id: "wide", label: "Wide", fov: 90, blurb: "Small rooms, more walls in frame." },
];

export function normalizeCustomCamera(input?: Partial<CustomCamera> | null): CustomCamera {
  const c = input || {};
  const dir = (["left", "right", "up", "down"] as CameraDirection[]).includes(
    c.direction as CameraDirection,
  )
    ? (c.direction as CameraDirection)
    : DEFAULT_CUSTOM_CAMERA.direction;
  return {
    direction: dir,
    rotation: Math.round(clamp(Number(c.rotation ?? DEFAULT_CUSTOM_CAMERA.rotation), 0, 180)),
    dolly: Math.round(clamp(Number(c.dolly ?? DEFAULT_CUSTOM_CAMERA.dolly), -12, 12) * 10) / 10,
    height: Math.round(clamp(Number(c.height ?? DEFAULT_CUSTOM_CAMERA.height), 1, 12) * 10) / 10,
    fov: Math.round(clamp(Number(c.fov ?? DEFAULT_CUSTOM_CAMERA.fov), 20, 120)),
  };
}

export function customCameraLabel(c: CustomCamera): string {
  const turn =
    c.rotation === 0
      ? "Straight On"
      : c.rotation + "\u00b0 " + { left: "Left", right: "Right", up: "Up", down: "Down" }[c.direction];
  const move = c.dolly === 0 ? "" : c.dolly > 0 ? ", " + c.dolly + "ft In" : ", " + Math.abs(c.dolly) + "ft Back";
  return "Custom \u00b7 " + turn + move;
}

export function customCameraDirective(c: CustomCamera): string {
  const rot =
    c.rotation === 0
      ? "Keep the camera pointed the same way as the source view"
      : "Rotate the camera about " +
        c.rotation +
        " degrees to the " +
        c.direction +
        " from the source view";
  const move =
    c.dolly === 0
      ? "keep the camera in the same position on the floor"
      : c.dolly > 0
        ? "move the camera about " + c.dolly + " feet forward into the room"
        : "move the camera about " + Math.abs(c.dolly) + " feet backward";
  return (
    rot +
    ", " +
    move +
    ", set the eye height to about " +
    c.height +
    " feet, and frame with roughly a " +
    c.fov +
    " degree horizontal field of view. Keep verticals straight."
  );
}

/* ---------------------------------------------------------- output sets */

export type OutputSetId = "single" | "three" | "four_corner" | "listing" | "video";

export type OutputSet = {
  id: OutputSetId;
  label: string;
  blurb: string;
  /** Preset angles this set selects. Empty means the user picks. */
  angles: CameraPresetId[];
  /** Ordered output intended for a sequence rather than a gallery. */
  sequence: boolean;
};

export const OUTPUT_SETS: OutputSet[] = [
  {
    id: "single",
    label: "One Angle",
    blurb: "A single new view of the same room.",
    angles: [],
    sequence: false,
  },
  {
    id: "three",
    label: "Three-Angle Set",
    blurb: "Left, right and a wider view.",
    angles: ["slight_left", "slight_right", "wider"],
    sequence: false,
  },
  {
    id: "four_corner",
    label: "Four-Corner Set",
    blurb: "Every corner of the same room.",
    angles: ["slight_left", "slight_right", "opposite_corner", "doorway"],
    sequence: false,
  },
  {
    id: "listing",
    label: "Listing Sequence",
    blurb: "Doorway, eye-level, wide, then detail. In listing order.",
    angles: ["doorway", "eye_level_center", "wider", "closer"],
    sequence: true,
  },
  {
    id: "video",
    label: "Video-Ready Sequence",
    blurb: "Ordered for a walkthrough edit, ready to send to Video.",
    angles: ["doorway", "slight_left", "eye_level_center", "slight_right", "closer"],
    sequence: true,
  },
];

export function outputSet(id?: string | null): OutputSet {
  return OUTPUT_SETS.find((s) => s.id === id) || OUTPUT_SETS[0]!;
}

/* --------------------------------------------------------- continuity */

export const CONTINUITY_LOCK: string[] = [
  "Room identity: this is the same room, not a similar one.",
  "Architecture: wall positions, ceiling height, beams and openings stay where they are.",
  "Windows and doors: same count, same size, same position, same view through the glass.",
  "Furniture: the same pieces in the same places, seen from the new position.",
  "Materials: floor, wall, counter and cabinet finishes are identical.",
  "Colour palette: identical hues across every view.",
  "Lighting and time of day: the same light direction, intensity and warmth.",
  "Décor: the same art, rugs, plants and styling objects.",
  "Design style: the same style brief with no restyling.",
];

export type ContinuitySignalId =
  | "structured_geometry"
  | "segmentation"
  | "depth"
  | "source_metadata"
  | "prior_prompt"
  | "seed"
  | "design_dna"
  | "reference_view";

export const CONTINUITY_SIGNALS: Array<{ id: ContinuitySignalId; label: string; blurb: string }> = [
  { id: "structured_geometry", label: "Structured Geometry", blurb: "Walls and openings from a drawing." },
  { id: "segmentation", label: "Segmentation", blurb: "Which pixels are floor, wall, window, furniture." },
  { id: "depth", label: "Depth Estimate", blurb: "How far each surface is from the camera." },
  { id: "source_metadata", label: "Source Metadata", blurb: "Room type, space and saved settings." },
  { id: "prior_prompt", label: "Prior Prompt", blurb: "The brief that produced the source image." },
  { id: "seed", label: "Seed / Reference", blurb: "The reference image every view is matched to." },
  { id: "design_dna", label: "Property Design DNA", blurb: "The palette and finishes used across this property." },
  { id: "reference_view", label: "First Approved View", blurb: "An earlier angle reused as the anchor." },
];

export function continuitySignal(id: string) {
  return CONTINUITY_SIGNALS.find((s) => s.id === id) || null;
}

export type RoomContinuity = {
  summary: string | null;
  architecture: string | null;
  windows: string | null;
  furniture: string | null;
  materials: string | null;
  palette: string | null;
  lighting: string | null;
  decor: string | null;
  style: string | null;
  unseen: string[];
};

export function emptyContinuity(): RoomContinuity {
  return {
    summary: null,
    architecture: null,
    windows: null,
    furniture: null,
    materials: null,
    palette: null,
    lighting: null,
    decor: null,
    style: null,
    unseen: [],
  };
}

export function normalizeContinuity(raw: unknown): RoomContinuity {
  const r = (raw || {}) as Record<string, unknown>;
  const pick = (k: string, max = 240) => str(r[k], max) || null;
  const unseen = Array.isArray(r["unseen"])
    ? (r["unseen"] as unknown[]).map((u) => str(u, 90)).filter(Boolean).slice(0, 8)
    : [];
  return {
    summary: pick("summary", 300),
    architecture: pick("architecture"),
    windows: pick("windows"),
    furniture: pick("furniture", 300),
    materials: pick("materials", 300),
    palette: pick("palette"),
    lighting: pick("lighting"),
    decor: pick("decor"),
    style: pick("style", 90),
    unseen,
  };
}

export function hasContinuity(c: RoomContinuity | null): boolean {
  return !!c && !!(c.summary || c.architecture || c.materials || c.furniture);
}

/** The continuity description handed to every render of one set. */
export function continuityBlock(c: RoomContinuity | null): string {
  if (!c) return "";
  const rows: Array<[string, string | null]> = [
    ["Room", c.summary],
    ["Architecture", c.architecture],
    ["Windows and doors", c.windows],
    ["Furniture", c.furniture],
    ["Materials", c.materials],
    ["Colour palette", c.palette],
    ["Lighting and time of day", c.lighting],
    ["Décor", c.decor],
    ["Design style", c.style],
  ];
  const body = rows.filter(([, v]) => !!v).map(([k, v]) => "- " + k + ": " + v);
  return body.length ? body.join("\n") : "";
}

/* -------------------------------------------------------------- runs */

export type AngleRun = {
  id: string;
  /** Preset behind this run, or "custom". */
  preset: CameraPresetId;
  /** User-facing name. Editable. */
  label: string;
  directive: string;
  camera: CustomCamera | null;
  showsUnseen: boolean;
};

export function newAngleSetId(): string {
  return "angleset-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

export function presetRun(id: CameraPresetId, index = 0): AngleRun {
  const p = cameraPreset(id);
  return {
    id: p.id + "-" + index,
    preset: p.id,
    label: p.label,
    directive: p.directive,
    camera: null,
    showsUnseen: p.showsUnseen,
  };
}

export function customRun(camera: CustomCamera, index = 0): AngleRun {
  const c = normalizeCustomCamera(camera);
  return {
    id: "custom-" + index,
    preset: "custom",
    label: customCameraLabel(c),
    directive: customCameraDirective(c),
    camera: c,
    showsUnseen: true,
  };
}

export function angleCredits(runs: number): number {
  return Math.max(0, Math.round(runs)) * CREDITS_PER_ANGLE;
}

export function costSentence(runs: number): string {
  const n = Math.max(0, Math.round(runs));
  if (!n) return "Select at least one camera angle.";
  const c = angleCredits(n);
  return (
    n +
    (n === 1 ? " angle" : " angles") +
    " \u00b7 " +
    c +
    (c === 1 ? " credit" : " credits") +
    " total. Nothing is charged until you confirm."
  );
}

/* ------------------------------------------------------------- payload */

export type AnglePayload = {
  set_id: string;
  source_kind: AngleSourceId;
  source_label: string;
  source_fidelity: AngleSourceFidelity;
  room_type: string | null;
  style_id: string | null;
  style_name: string | null;
  output_set: OutputSetId;
  output_set_label: string;
  sequence: boolean;
  continuity: RoomContinuity;
  signals: ContinuitySignalId[];
  prior_prompt: string | null;
  design_dna: string | null;
  notes: string | null;
  disclosure: string | null;
  total_angles: number;
};

export type AngleBrief = {
  valid: boolean;
  missing: string[];
  warnings: string[];
  credits: number;
  costSentence: string;
  runs: AngleRun[];
  payload: AnglePayload;
  lines: Array<{ k: string; v: string }>;
  disclosure: string | null;
};

export type AngleSettings = {
  setId?: string | null;
  sourceKind: AngleSourceId;
  hasSource: boolean;
  selected: CameraPresetId[];
  customCameras: CustomCamera[];
  /** Optional explicit run list, used when regenerating one failed angle. */
  runs?: AngleRun[] | null;
  outputSet: OutputSetId;
  continuity: RoomContinuity | null;
  signals: ContinuitySignalId[];
  roomType?: string | null;
  styleId?: string | null;
  styleName?: string | null;
  priorPrompt?: string | null;
  designDna?: string | null;
  notes?: string | null;
};

/** Turn selected presets and custom cameras into the ordered run list. */
export function buildRuns(input: {
  selected: CameraPresetId[];
  customCameras: CustomCamera[];
  outputSet: OutputSetId;
}): AngleRun[] {
  const set = outputSet(input.outputSet);
  const order = set.angles.length ? set.angles : input.selected;
  const seen = new Set<string>();
  const runs: AngleRun[] = [];
  order.forEach((id) => {
    if (id === "custom" || seen.has(id)) return;
    if (set.angles.length || input.selected.includes(id)) {
      seen.add(id);
      runs.push(presetRun(id, runs.length));
    }
  });
  input.customCameras.forEach((c) => runs.push(customRun(c, runs.length)));
  return runs;
}

export function buildAngleBrief(input: AngleSettings): AngleBrief {
  const source = angleSource(input.sourceKind);
  const runs = input.runs && input.runs.length
    ? input.runs
    : buildRuns({
        selected: input.selected || [],
        customCameras: input.customCameras || [],
        outputSet: input.outputSet,
      });
  const set = outputSet(input.outputSet);
  const missing: string[] = [];
  if (!input.hasSource) missing.push("Add a photo or open a design first");
  if (!runs.length) missing.push("Select at least one camera angle");

  const warnings: string[] = [];
  if (source.infers) warnings.push(INFERENCE_DISCLOSURE);
  if (source.infers && runs.some((r) => r.showsUnseen))
    warnings.push(
      "These angles look at walls the original photograph never saw, so those areas are invented rather than documented.",
    );
  if (!hasContinuity(input.continuity))
    warnings.push(
      "The room has not been read yet, so continuity is matched from the image alone. Read The Room for a stronger match.",
    );
  if (runs.length > 6)
    warnings.push("Large sets drift more. Six angles or fewer hold continuity best.");

  const disclosure = source.infers ? INFERENCE_DISCLOSURE : null;
  const credits = angleCredits(runs.length);

  const payload: AnglePayload = {
    set_id: input.setId || newAngleSetId(),
    source_kind: source.id,
    source_label: source.label,
    source_fidelity: source.fidelity,
    room_type: input.roomType || null,
    style_id: input.styleId || null,
    style_name: input.styleName || null,
    output_set: set.id,
    output_set_label: set.label,
    sequence: set.sequence,
    continuity: input.continuity || emptyContinuity(),
    signals: (input.signals || []).filter((s) => !!continuitySignal(s)),
    prior_prompt: input.priorPrompt || null,
    design_dna: input.designDna || null,
    notes: input.notes || null,
    disclosure,
    total_angles: runs.length,
  };

  const lines: Array<{ k: string; v: string }> = [
    { k: "Source", v: source.label },
    { k: "Output", v: set.label },
    { k: "Angles", v: runs.map((r) => r.label).join(", ") || "None selected" },
    { k: "Continuity", v: hasContinuity(input.continuity) ? "Locked to the read room" : "Matched from the image" },
  ];
  if (payload.room_type) lines.push({ k: "Room", v: payload.room_type });
  if (payload.style_name) lines.push({ k: "Style", v: payload.style_name });
  if (payload.signals.length)
    lines.push({
      k: "Reused",
      v: payload.signals.map((s) => continuitySignal(s)?.label || s).join(", "),
    });
  if (payload.notes) lines.push({ k: "Notes", v: payload.notes });

  return {
    valid: !missing.length,
    missing,
    warnings,
    credits,
    costSentence: costSentence(runs.length),
    runs,
    payload,
    lines,
    disclosure,
  };
}

/* -------------------------------------------------------------- prompt */

export function anglePrompt(payload: AnglePayload, run: AngleRun, hasReference: boolean): string {
  const parts: string[] = [];
  parts.push(
    "You are producing one additional camera view of a room that already exists in the attached image" +
      (hasReference
        ? ". A second image is attached: it is an already approved view of the same room. Match it exactly for materials, colour, furniture and light."
        : "."),
  );
  parts.push("This is the same room photographed again from a different position. It is not a redesign.");
  parts.push("CAMERA MOVE: " + run.directive);
  const cont = continuityBlock(payload.continuity);
  if (cont) parts.push("THE ROOM AS READ:\n" + cont);
  if (payload.room_type) parts.push("Room type: " + payload.room_type + ".");
  if (payload.style_name) parts.push("Design style, unchanged: " + payload.style_name + ".");
  if (payload.prior_prompt) parts.push("The brief that produced this design: " + payload.prior_prompt);
  if (payload.design_dna) parts.push("Property design DNA to respect: " + payload.design_dna);
  parts.push("CONTINUITY LOCK — every one of these must be identical to the source view:\n" + CONTINUITY_LOCK.map((l) => "- " + l).join("\n"));
  parts.push(
    "Do not invent extra rooms, extra windows, extra doors or extra square footage. Do not change the season, weather or time of day. Do not restyle, redecorate or replace any furniture.",
  );
  if (run.showsUnseen)
    parts.push(
      "Parts of this view were not visible in the source image. Continue the same architecture, the same finishes and the same lighting into those areas plausibly and conservatively. Never introduce a feature that contradicts what is visible.",
    );
  if (payload.notes) parts.push("Agent notes: " + payload.notes);
  parts.push(
    "Output one photorealistic real-estate photograph at the same image quality, exposure and white balance as the source, with straight verticals and no text, watermark or border.",
  );
  return parts.join("\n\n");
}

/* --------------------------------------------------------- consistency */

export type ConsistencyCheckId =
  | "window_moved"
  | "door_changed"
  | "furniture_changed"
  | "material_changed"
  | "room_shape_drift"
  | "lighting_inconsistent";

export const CONSISTENCY_CHECKS: Array<{
  id: ConsistencyCheckId;
  label: string;
  question: string;
}> = [
  {
    id: "window_moved",
    label: "Moving Windows",
    question: "Has a window moved, changed size, appeared or disappeared between the two views?",
  },
  {
    id: "door_changed",
    label: "Changed Doors",
    question: "Has a door moved, changed style, appeared or disappeared?",
  },
  {
    id: "furniture_changed",
    label: "Different Furniture",
    question: "Is any furniture a different piece, a different colour, or in a different place?",
  },
  {
    id: "material_changed",
    label: "Changed Materials",
    question: "Has a floor, wall, counter or cabinet finish changed material or tone?",
  },
  {
    id: "room_shape_drift",
    label: "Room-Shape Drift",
    question: "Do the two views describe rooms of different shape, proportion or ceiling height?",
  },
  {
    id: "lighting_inconsistent",
    label: "Lighting Inconsistency",
    question: "Does the light direction, intensity, warmth or time of day differ between the views?",
  },
];

export type ConsistencyIssue = {
  id: ConsistencyCheckId;
  severity: "minor" | "major";
  detail: string;
};

export type AngleScore = {
  runId: string;
  label: string;
  score: number;
  passed: boolean;
  issues: ConsistencyIssue[];
};

export type ConsistencyReport = {
  angles: AngleScore[];
  score: number;
  failing: string[];
  headline: string;
  disclosure: string | null;
};

/** 100 minus 18 per major issue and 6 per minor one, floored at zero. */
export function scoreIssues(issues: ConsistencyIssue[]): number {
  const penalty = issues.reduce((sum, i) => sum + (i.severity === "major" ? 18 : 6), 0);
  return Math.max(0, 100 - penalty);
}

export function normalizeConsistency(
  raw: unknown,
  run: { id: string; label: string },
): AngleScore {
  const r = (raw || {}) as Record<string, unknown>;
  const ids = CONSISTENCY_CHECKS.map((c) => c.id);
  const list = Array.isArray(r["issues"]) ? r["issues"] : [];
  const issues: ConsistencyIssue[] = [];
  list.forEach((entry) => {
    const e = (entry || {}) as Record<string, unknown>;
    const id = String(e["id"] || "") as ConsistencyCheckId;
    if (!ids.includes(id)) return;
    const detail = str(e["detail"], 220);
    if (!detail) return;
    issues.push({ id, severity: e["severity"] === "major" ? "major" : "minor", detail });
  });
  const score = scoreIssues(issues);
  return { runId: run.id, label: run.label, score, passed: score >= 70, issues };
}

export function summarizeConsistency(
  angles: AngleScore[],
  disclosure: string | null = null,
): ConsistencyReport {
  const score = angles.length
    ? Math.round(angles.reduce((s, a) => s + a.score, 0) / angles.length)
    : 100;
  const failing = angles.filter((a) => !a.passed).map((a) => a.runId);
  const headline = !angles.length
    ? "No angles scored yet."
    : failing.length
      ? failing.length + (failing.length === 1 ? " angle drifts" : " angles drift") + " from the source room."
      : "Every angle matches the source room.";
  return { angles, score, failing, headline, disclosure };
}

/* -------------------------------------------------------- persistence */

export type AngleResultMeta = {
  tool: "Angles";
  angle_set_id: string;
  angle_id: string;
  angle_label: string;
  angle_index: number;
  angle_total: number;
  preset: CameraPresetId;
  camera: CustomCamera | null;
  camera_instruction: string;
  source_kind: AngleSourceId;
  source_label: string;
  source_fidelity: AngleSourceFidelity;
  source_version: string | null;
  output_set: OutputSetId;
  output_set_label: string;
  sequence: boolean;
  continuity: RoomContinuity;
  signals: ContinuitySignalId[];
  room_type: string | null;
  style_id: string | null;
  style_name: string | null;
  instructions: string | null;
  inferred_disclosure: string | null;
  quality_score: number | null;
  quality_issues: ConsistencyIssue[];
  video_selected: boolean;
  model: string;
  at: string;
};

export function angleMeta(input: {
  payload: AnglePayload;
  run: AngleRun;
  index: number;
  sourceVersion: string | null;
  score?: AngleScore | null;
  model?: string;
  videoSelected?: boolean;
}): AngleResultMeta {
  const p = input.payload;
  return {
    tool: "Angles",
    angle_set_id: p.set_id,
    angle_id: input.run.id,
    angle_label: input.run.label,
    angle_index: input.index,
    angle_total: p.total_angles,
    preset: input.run.preset,
    camera: input.run.camera,
    camera_instruction: input.run.directive,
    source_kind: p.source_kind,
    source_label: p.source_label,
    source_fidelity: p.source_fidelity,
    source_version: input.sourceVersion,
    output_set: p.output_set,
    output_set_label: p.output_set_label,
    sequence: p.sequence,
    continuity: p.continuity,
    signals: p.signals,
    room_type: p.room_type,
    style_id: p.style_id,
    style_name: p.style_name,
    instructions: p.notes,
    inferred_disclosure: p.disclosure,
    quality_score: input.score ? input.score.score : null,
    quality_issues: input.score ? input.score.issues : [],
    video_selected: !!input.videoSelected,
    model: input.model || "google/gemini-2.5-flash-image",
    at: new Date().toISOString(),
  };
}

export type RestoredAngles = {
  setId: string;
  sourceKind: AngleSourceId;
  outputSet: OutputSetId;
  selected: CameraPresetId[];
  customCameras: CustomCamera[];
  continuity: RoomContinuity;
  signals: ContinuitySignalId[];
};

export function restoreFromAngleMeta(meta: unknown): RestoredAngles | null {
  const m = (meta || {}) as Record<string, any>;
  if (!m || m["tool"] !== "Angles") return null;
  const preset = String(m["preset"] || "") as CameraPresetId;
  return {
    setId: str(m["angle_set_id"], 60) || newAngleSetId(),
    sourceKind: angleSource(m["source_kind"]).id,
    outputSet: outputSet(m["output_set"]).id,
    selected: preset && preset !== "custom" ? [preset] : [],
    customCameras: m["camera"] ? [normalizeCustomCamera(m["camera"])] : [],
    continuity: normalizeContinuity(m["continuity"]),
    signals: Array.isArray(m["signals"])
      ? (m["signals"] as string[]).filter((s) => !!continuitySignal(s)) as ContinuitySignalId[]
      : [],
  };
}

/* ------------------------------------------------------- contact sheet */

export type AngleResult = {
  runId: string;
  label: string;
  image: string | null;
  path: string | null;
  error: string | null;
  score: number | null;
  issues: ConsistencyIssue[];
  order: number;
  videoSelected: boolean;
  preset: CameraPresetId;
  hotspots: unknown[];
};

/** Moves one result up or down and rewrites the order numbers. */
export function reorderResults(list: AngleResult[], runId: string, delta: number): AngleResult[] {
  const sorted = list.slice().sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((r) => r.runId === runId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= sorted.length) return sorted.map((r, k) => ({ ...r, order: k }));
  const copy = sorted.slice();
  const a = copy[i]!;
  copy[i] = copy[j]!;
  copy[j] = a;
  return copy.map((r, k) => ({ ...r, order: k }));
}

export function renameResult(list: AngleResult[], runId: string, label: string): AngleResult[] {
  const name = str(label, 60);
  return list.map((r) => (r.runId === runId && name ? { ...r, label: name } : r));
}

export function toggleVideoSelection(list: AngleResult[], runId: string): AngleResult[] {
  return list.map((r) => (r.runId === runId ? { ...r, videoSelected: !r.videoSelected } : r));
}

export function videoSequence(list: AngleResult[]): AngleResult[] {
  return list
    .filter((r) => r.videoSelected && r.image)
    .slice()
    .sort((a, b) => a.order - b.order);
}

export function failedResults(list: AngleResult[]): AngleResult[] {
  return list.filter((r) => !r.image || (r.score !== null && r.score < 70));
}
