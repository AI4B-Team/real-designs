/**
 * The Virtual Stage brief.
 *
 * One pure, DOM-free module owns everything that must be true BEFORE a credit
 * is spent for staging: the staging mode, source validation against what the
 * photograph actually shows, occupancy and purpose, room-aware furniture
 * choices, placement rules, the prompt the model receives, the multi-variation
 * plan and its real cost, and the post-generation quality checks.
 *
 * The client panel, the generation handler and the server prompt all read
 * these definitions, so every rule here is unit-testable.
 */

/* ---------------------------------------------------------------- modes */

export type StageModeId =
  | "empty"
  | "restage"
  | "add_items"
  | "replace"
  | "remove_restage";

/** What the photograph shows before staging. */
export type Occupancy = "empty" | "partial" | "furnished" | "unknown";

export type StageMode = {
  id: StageModeId;
  label: string;
  blurb: string;
  /** Source occupancy this mode is designed for. */
  expects: Occupancy[];
  /** Whether the mode is allowed to delete furniture that is really there. */
  removesExisting: boolean;
  /** The instruction the model is given for this mode. */
  directive: string;
};

export const STAGE_MODES: StageMode[] = [
  {
    id: "empty",
    label: "Stage Empty Room",
    blurb: "Furnish a room that is already empty. Nothing existing is deleted.",
    expects: ["empty"],
    removesExisting: false,
    directive:
      "The room is empty. Add furniture and décor to the empty floor area only. " +
      "You must not delete, hide or paint over anything that is physically present in the photograph.",
  },
  {
    id: "restage",
    label: "Restage Furnished Room",
    blurb: "Replace the current furnishings with a new, cohesive set.",
    expects: ["partial", "furnished"],
    removesExisting: true,
    directive:
      "The room is already furnished. Replace the existing loose furniture and décor with a new cohesive set. " +
      "Built-ins, appliances and permanent finishes are not furniture and must stay exactly as photographed.",
  },
  {
    id: "add_items",
    label: "Add Selected Items",
    blurb: "Keep everything that is there and add only the pieces you choose.",
    expects: ["partial", "furnished", "empty"],
    removesExisting: false,
    directive:
      "Keep every existing item exactly as photographed and add only the requested pieces into genuinely free floor area.",
  },
  {
    id: "replace",
    label: "Replace Existing Furniture",
    blurb: "Swap named pieces for better ones and leave the rest alone.",
    expects: ["partial", "furnished"],
    removesExisting: true,
    directive:
      "Replace only the named pieces with equivalents in the chosen direction, at the same footprint and position. " +
      "Every item not named stays exactly as photographed.",
  },
  {
    id: "remove_restage",
    label: "Remove Furniture And Restage",
    blurb: "Clear the room back to its shell, then stage it fresh.",
    expects: ["partial", "furnished"],
    removesExisting: true,
    directive:
      "First remove the loose furniture and décor and rebuild the floor, wall and baseline surfaces they hid, " +
      "then stage the cleared room from scratch. Built-ins and permanent finishes are never removed.",
  },
];

export const DEFAULT_STAGE_MODE: StageModeId = "empty";

export function stageMode(id?: string | null): StageMode {
  const key = String(id || "").trim().toLowerCase();
  return STAGE_MODES.find((m) => m.id === key) || STAGE_MODES[0]!;
}

/* ------------------------------------------------------ room understanding */

export type DetectedFeatureId =
  | "floor"
  | "walls"
  | "windows"
  | "doors"
  | "walkways"
  | "built_ins"
  | "fireplace"
  | "kitchen_island"
  | "fixtures"
  | "stairs";

export const FEATURE_LABEL: Record<DetectedFeatureId, string> = {
  floor: "Floor Boundary",
  walls: "Wall Boundaries",
  windows: "Windows",
  doors: "Doors",
  walkways: "Walkways",
  built_ins: "Built-Ins",
  fireplace: "Fireplace",
  kitchen_island: "Kitchen Island",
  fixtures: "Major Fixtures",
  stairs: "Stairs",
};

export const FEATURE_IDS = Object.keys(FEATURE_LABEL) as DetectedFeatureId[];

/** What the analysis pass reports about the photograph. */
export type RoomAnalysis = {
  roomType: string | null;
  occupancy: Occupancy;
  /** 0..1 confidence in the occupancy call. */
  confidence: number;
  /** Feature ids the model believes are visible. */
  features: DetectedFeatureId[];
  /** Loose furniture the model can name, e.g. "sofa", "dining table". */
  furniture: string[];
  /** Plain-language description of the usable furniture zones. */
  zones: string[];
  /** One honest sentence about the photograph. */
  summary: string | null;
};

export function emptyAnalysis(): RoomAnalysis {
  return {
    roomType: null,
    occupancy: "unknown",
    confidence: 0,
    features: [],
    furniture: [],
    zones: [],
    summary: null,
  };
}

const OCCUPANCY_LABEL: Record<Occupancy, string> = {
  empty: "Empty",
  partial: "Partially Furnished",
  furnished: "Fully Furnished",
  unknown: "Not Analyzed Yet",
};

export function occupancyLabel(o: Occupancy): string {
  return OCCUPANCY_LABEL[o] || OCCUPANCY_LABEL.unknown;
}

/** Normalizes whatever the model returned into a usable analysis. */
export function normalizeAnalysis(raw: unknown): RoomAnalysis {
  const r = (raw || {}) as Record<string, any>;
  const occRaw = String(r["occupancy"] || "").toLowerCase();
  const occupancy: Occupancy =
    occRaw === "empty" || occRaw === "vacant"
      ? "empty"
      : occRaw === "partial" || occRaw === "partially_furnished" || occRaw === "sparse"
        ? "partial"
        : occRaw === "furnished" || occRaw === "fully_furnished" || occRaw === "full"
          ? "furnished"
          : "unknown";
  const feats = Array.isArray(r["features"]) ? r["features"] : [];
  const features = feats
    .map((f: unknown) => String(f || "").trim().toLowerCase().replace(/[\s-]+/g, "_"))
    .filter((f: string): f is DetectedFeatureId => (FEATURE_IDS as string[]).includes(f));
  const list = (v: unknown, max: number) =>
    (Array.isArray(v) ? v : [])
      .map((x: unknown) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, max);
  const conf = Number(r["confidence"]);
  return {
    roomType: r["room_type"] ? String(r["room_type"]).trim() : null,
    occupancy,
    confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0,
    features: Array.from(new Set(features)),
    furniture: list(r["furniture"], 20),
    zones: list(r["zones"], 8),
    summary: r["summary"] ? String(r["summary"]).trim().slice(0, 300) : null,
  };
}

/* ------------------------------------------------------- source validation */

export type FitLevel = "ok" | "warn" | "block";

export type ModeFit = { level: FitLevel; message: string | null };

/**
 * Does the chosen mode match the photograph? A mismatch is a warning the user
 * must see, never a silent behaviour change.
 */
export function modeFit(modeId: string, analysis: RoomAnalysis | null): ModeFit {
  const mode = stageMode(modeId);
  if (!analysis || analysis.occupancy === "unknown")
    return { level: "warn", message: "This photo has not been analyzed yet." };
  if (mode.expects.includes(analysis.occupancy)) return { level: "ok", message: null };
  if (mode.id === "empty" && analysis.occupancy !== "empty")
    return {
      level: "warn",
      message:
        "This room looks " +
        occupancyLabel(analysis.occupancy).toLowerCase() +
        ". Stage Empty Room will not delete what is already there — choose Restage Furnished Room or Remove Furniture And Restage instead.",
    };
  if (analysis.occupancy === "empty")
    return {
      level: "warn",
      message:
        "This room looks empty, so there is nothing for " +
        mode.label +
        " to work with. Stage Empty Room fits this photo.",
    };
  return {
    level: "warn",
    message: mode.label + " does not match what this photo shows (" + occupancyLabel(analysis.occupancy) + ").",
  };
}

/* ------------------------------------------------------- staging settings */

export type OccupancyLevelId = "minimal" | "balanced" | "full";

export const OCCUPANCY_LEVELS: Array<{ id: OccupancyLevelId; label: string; blurb: string; rule: string }> = [
  {
    id: "minimal",
    label: "Minimal",
    blurb: "Only the essential pieces. Lots of open floor.",
    rule: "Minimal occupancy: only the essential pieces for the room's function, generous open floor, almost no accessories.",
  },
  {
    id: "balanced",
    label: "Balanced",
    blurb: "A complete, liveable set without crowding.",
    rule: "Balanced occupancy: a complete, liveable furniture set with restrained accessories and clear circulation.",
  },
  {
    id: "full",
    label: "Fully Styled",
    blurb: "Complete furnishings plus layered décor.",
    rule: "Fully styled occupancy: complete furnishings plus layered décor, art, textiles and plants, still without blocking circulation.",
  },
];

export const DEFAULT_OCCUPANCY_LEVEL: OccupancyLevelId = "balanced";

export function occupancyLevel(id?: string | null): (typeof OCCUPANCY_LEVELS)[number] {
  const key = String(id || "").toLowerCase();
  return OCCUPANCY_LEVELS.find((o) => o.id === key) || OCCUPANCY_LEVELS[1]!;
}

export type PurposeId = "mls" | "str" | "model_home" | "owner" | "luxury";

export const PURPOSES: Array<{ id: PurposeId; label: string; rule: string; disclose: boolean }> = [
  {
    id: "mls",
    label: "MLS Listing",
    rule: "Purpose is an MLS listing photo: broadly appealing, neutral, uncluttered, nothing that dates or personalizes the room. No family photos, no branding.",
    disclose: true,
  },
  {
    id: "str",
    label: "Short-Term Rental",
    rule: "Purpose is a short-term rental listing: durable, guest-ready furnishings, generous seating and sleeping capacity, hospitality styling.",
    disclose: true,
  },
  {
    id: "model_home",
    label: "Model Home",
    rule: "Purpose is a builder model home: aspirational but reproducible furnishings, showroom-clean styling, coordinated palette.",
    disclose: true,
  },
  {
    id: "owner",
    label: "Owner-Occupied Inspiration",
    rule: "Purpose is inspiration for the owner who lives here: comfortable, realistic, personal-feeling furnishings.",
    disclose: false,
  },
  {
    id: "luxury",
    label: "Luxury Presentation",
    rule: "Purpose is a luxury presentation: designer-grade furniture, sculptural lighting, layered textiles, editorial styling.",
    disclose: true,
  },
];

export const DEFAULT_PURPOSE: PurposeId = "mls";

export function purpose(id?: string | null): (typeof PURPOSES)[number] {
  const key = String(id || "").toLowerCase();
  return PURPOSES.find((p) => p.id === key) || PURPOSES[0]!;
}

export const PALETTES: Array<{ id: string; label: string; rule: string }> = [
  { id: "auto", label: "Match The Room", rule: "Draw the palette from the finishes already in the photograph." },
  { id: "warm_neutral", label: "Warm Neutral", rule: "Warm neutral palette: oatmeal, sand, camel, warm white, natural oak." },
  { id: "cool_neutral", label: "Cool Neutral", rule: "Cool neutral palette: greige, soft grey, cool white, pale ash." },
  { id: "earthy", label: "Earthy", rule: "Earthy palette: clay, olive, terracotta, walnut, unglazed ceramic." },
  { id: "coastal", label: "Coastal", rule: "Coastal palette: soft blue, seafoam, bleached wood, white linen." },
  { id: "monochrome", label: "Monochrome", rule: "Monochrome palette: charcoal, ivory, black metal, minimal colour." },
  { id: "bold_accent", label: "Bold Accent", rule: "Neutral base with one confident accent colour repeated two or three times." },
];

export function palette(id?: string | null) {
  const key = String(id || "").toLowerCase();
  return PALETTES.find((p) => p.id === key) || PALETTES[0]!;
}

/* --------------------------------------------------- furniture categories */

export type RoomFamily =
  | "living"
  | "bedroom"
  | "dining"
  | "kitchen"
  | "office"
  | "bath"
  | "outdoor"
  | "other";

export function roomFamily(roomType?: string | null): RoomFamily {
  const v = String(roomType || "").toLowerCase();
  if (!v) return "other";
  if (/bed|nursery|primary suite/.test(v)) return "bedroom";
  if (/dining|breakfast nook/.test(v)) return "dining";
  if (/kitchen|pantry/.test(v)) return "kitchen";
  if (/office|study|den|workspace/.test(v)) return "office";
  if (/bath|powder|ensuite/.test(v)) return "bath";
  if (/patio|deck|balcony|yard|garden|porch|pool|exterior|outdoor|terrace/.test(v)) return "outdoor";
  if (/living|family|great room|lounge|loft|basement|entry|foyer|hallway/.test(v)) return "living";
  return "other";
}

const CATEGORIES: Record<RoomFamily, string[]> = {
  living: ["Seating", "Coffee Table", "Media Console", "Rug", "Lighting", "Art", "Plants", "Side Tables", "Window Treatments"],
  bedroom: ["Bed", "Nightstands", "Dresser", "Rug", "Lighting", "Art", "Bench", "Seating", "Window Treatments"],
  dining: ["Dining Table", "Dining Chairs", "Sideboard", "Rug", "Pendant Lighting", "Art", "Centerpiece"],
  kitchen: ["Counter Stools", "Styling Props", "Rug/Runner", "Plants", "Art"],
  office: ["Desk", "Task Chair", "Shelving", "Rug", "Lighting", "Art", "Guest Seating", "Plants"],
  bath: ["Towels And Linens", "Vanity Styling", "Plants", "Art", "Bath Mat"],
  outdoor: ["Lounge Seating", "Dining Set", "Outdoor Rug", "Umbrella Or Shade", "Planters", "Fire Feature", "Lighting"],
  other: ["Seating", "Tables", "Rug", "Lighting", "Art", "Plants", "Storage"],
};

export function furnitureCategories(roomType?: string | null): string[] {
  return CATEGORIES[roomFamily(roomType)];
}

/* ------------------------------------------------------ room-aware options */

export type RoomOption = {
  id: string;
  label: string;
  choices: string[];
  fallback: string;
  /** Turned into a model instruction only when the user picked something. */
  rule: (value: string) => string;
};

export function roomOptions(roomType?: string | null): RoomOption[] {
  switch (roomFamily(roomType)) {
    case "bedroom":
      return [
        {
          id: "bed_size",
          label: "Bed Size",
          choices: ["Twin", "Full", "Queen", "King", "California King"],
          fallback: "Queen",
          rule: (v) => `Use a ${v} bed, scaled correctly against the walls and windows in the photograph.`,
        },
      ];
    case "dining":
      return [
        {
          id: "dining_seats",
          label: "Seat Count",
          choices: ["2", "4", "6", "8", "10"],
          fallback: "6",
          rule: (v) =>
            `Seat exactly ${v} people at the dining table, with at least 900mm of clearance behind each pulled-out chair.`,
        },
      ];
    case "office":
      return [
        {
          id: "desk_config",
          label: "Desk Configuration",
          choices: ["Single Desk", "Desk Facing Window", "L-Shaped Desk", "Two-Person Desk", "Standing Desk"],
          fallback: "Single Desk",
          rule: (v) => `Desk configuration: ${v}, positioned so the chair has real circulation space.`,
        },
      ];
    case "outdoor":
      return [
        {
          id: "weather",
          label: "Weather-Appropriate Furniture",
          choices: ["All-Weather Wicker", "Teak", "Powder-Coated Aluminum", "Concrete And Rope", "Covered Patio Soft Goods"],
          fallback: "All-Weather Wicker",
          rule: (v) =>
            `Use ${v} outdoor furniture with weather-rated cushions and outdoor-grade textiles. No indoor upholstery outdoors.`,
        },
      ];
    default:
      return [];
  }
}

/* ------------------------------------------------------------ zone painting */

/**
 * Zones are painted on a 6 x 4 grid over the source photograph. Cells are
 * "c{col}r{row}", 1-indexed from the top-left, and are described to the model
 * as fractions of the frame so they survive any output ratio.
 */
export const ZONE_COLS = 6;
export const ZONE_ROWS = 4;

export function zoneCellId(col: number, row: number): string {
  return "c" + col + "r" + row;
}

export function describeZones(cells: string[]): string {
  const valid = (cells || [])
    .map((c) => /^c(\d+)r(\d+)$/.exec(String(c).trim()))
    .filter(Boolean) as RegExpExecArray[];
  if (!valid.length) return "";
  return valid
    .map((m) => {
      const col = Number(m[1]);
      const row = Number(m[2]);
      const x0 = Math.round(((col - 1) / ZONE_COLS) * 100);
      const x1 = Math.round((col / ZONE_COLS) * 100);
      const y0 = Math.round(((row - 1) / ZONE_ROWS) * 100);
      const y1 = Math.round((row / ZONE_ROWS) * 100);
      return `${x0}–${x1}% across, ${y0}–${y1}% down`;
    })
    .join("; ");
}

/* ------------------------------------------------------- placement rules */

export const PLACEMENT_RULES: string[] = [
  "Furniture must be at real-world scale relative to the doors, windows, counters and ceiling height in the photograph.",
  "Keep every walkway and circulation path clear; a person must be able to walk through the room.",
  "Never block a doorway, a door swing or a stair.",
  "Never cover a window; keep glass, frames and the daylight coming through them visible.",
  "No furniture may intersect, overlap or pass through a wall, column or built-in.",
  "No duplicated furniture: one sofa, one bed, one dining table unless the room genuinely has two zones.",
  "Nothing floats: every object rests on the floor plane with correct contact points.",
  "Rugs lie flat in the floor plane and follow the room's perspective without warping or bending.",
  "Every added object casts a correct, soft contact shadow consistent with the existing light direction.",
  "All added geometry follows the photograph's existing vanishing points and horizon.",
  "Furniture must suit the room's actual function.",
  "Permanent surfaces — flooring, wall finish, ceiling, trim, cabinetry, counters, tile, fixtures, built-ins — stay exactly as photographed unless explicitly requested.",
];

export const STAGE_PROMISE =
  "Add realistic, appropriately scaled furniture and décor while preserving the photographed room, architecture and existing permanent finishes.";

/* -------------------------------------------------------------- variations */

export type VariationId = "primary" | "layout" | "furniture" | "lighter" | "fuller";

export type VariationChoice = {
  id: VariationId;
  label: string;
  blurb: string;
  directive: string;
};

export const VARIATION_CHOICES: VariationChoice[] = [
  {
    id: "layout",
    label: "Same Style, Different Layout",
    blurb: "Identical furniture direction, rearranged in the room.",
    directive:
      "Keep the same style and furniture grade, but arrange the room in a genuinely different, equally valid layout.",
  },
  {
    id: "furniture",
    label: "Same Layout, Different Furniture",
    blurb: "Same arrangement, different pieces.",
    directive:
      "Keep the same layout and zones, but choose visibly different furniture pieces within the same style.",
  },
  {
    id: "lighter",
    label: "Lighter Staging",
    blurb: "Fewer pieces, more open floor.",
    directive: "Stage this more lightly than the main option: fewer pieces and noticeably more open floor.",
  },
  {
    id: "fuller",
    label: "Fuller Staging",
    blurb: "More furniture and layered décor.",
    directive: "Stage this more fully than the main option: complete furnishings plus layered décor and accessories.",
  },
];

export type StageRun = { id: VariationId; label: string; directive: string };

/** The primary result is always first; extra variations are opt-in. */
export function buildRuns(extras: string[] | null | undefined): StageRun[] {
  const runs: StageRun[] = [{ id: "primary", label: "Main Staging", directive: "" }];
  const seen = new Set<string>();
  (extras || []).forEach((id) => {
    const key = String(id || "").toLowerCase();
    if (seen.has(key)) return;
    const choice = VARIATION_CHOICES.find((c) => c.id === key);
    if (!choice) return;
    seen.add(key);
    runs.push({ id: choice.id, label: choice.label, directive: choice.directive });
  });
  return runs;
}

export const CREDITS_PER_RESULT = 1;

export function variationCost(runs: StageRun[] | number): number {
  const n = typeof runs === "number" ? runs : runs.length;
  return Math.max(1, Math.round(n)) * CREDITS_PER_RESULT;
}

/** Honest copy: never imply several results are included in one credit. */
export function costSentence(runs: StageRun[]): string {
  const n = runs.length;
  const c = variationCost(runs);
  return n === 1
    ? "1 result for 1 credit."
    : `${n} results, ${c} credits total — 1 credit per result. Each result is generated separately.`;
}

/* --------------------------------------------------------- quality checks */

export type QualityIssueId =
  | "blocked_opening"
  | "distorted_furniture"
  | "floating_item"
  | "architecture_drift"
  | "scale_error"
  | "duplicate_object";

export const QUALITY_CHECKS: Array<{ id: QualityIssueId; label: string; question: string }> = [
  { id: "blocked_opening", label: "Blocked Openings", question: "Is any door, doorway, stair or window blocked or covered by added furniture?" },
  { id: "distorted_furniture", label: "Distorted Furniture", question: "Is any added furniture melted, warped, bent or anatomically impossible?" },
  { id: "floating_item", label: "Floating Items", question: "Does any added object float, hover or lack a contact shadow?" },
  { id: "architecture_drift", label: "Architecture Drift", question: "Have walls, windows, doors, ceiling, flooring, cabinetry or fixtures changed from the source photo?" },
  { id: "scale_error", label: "Scale Errors", question: "Is any furniture obviously the wrong size for the room?" },
  { id: "duplicate_object", label: "Duplicate Objects", question: "Is any furniture duplicated in an implausible way?" },
];

export type QualityIssue = {
  id: QualityIssueId;
  severity: "minor" | "major";
  detail: string;
};

export type QualityReport = {
  issues: QualityIssue[];
  /** True when the result is too broken to present as a staged photo. */
  rejected: boolean;
  headline: string;
};

export function normalizeQuality(raw: unknown): QualityReport {
  const list = Array.isArray((raw as any)?.issues) ? (raw as any).issues : [];
  const ids = new Set(QUALITY_CHECKS.map((c) => c.id));
  const issues: QualityIssue[] = [];
  list.forEach((i: any) => {
    const id = String(i?.id || "").trim().toLowerCase() as QualityIssueId;
    if (!ids.has(id)) return;
    if (issues.some((x) => x.id === id)) return;
    issues.push({
      id,
      severity: String(i?.severity || "").toLowerCase() === "major" ? "major" : "minor",
      detail: String(i?.detail || "").trim().slice(0, 240) || QUALITY_CHECKS.find((c) => c.id === id)!.label,
    });
  });
  return summarizeQuality(issues);
}

/** Two or more major faults means the render is not usable as a staged photo. */
export function summarizeQuality(issues: QualityIssue[]): QualityReport {
  const major = issues.filter((i) => i.severity === "major");
  const rejected =
    major.length >= 2 ||
    major.some((i) => i.id === "distorted_furniture" || i.id === "architecture_drift");
  return {
    issues,
    rejected,
    headline: !issues.length
      ? "Quality checks passed."
      : rejected
        ? "This result did not pass quality checks."
        : issues.length + " thing" + (issues.length > 1 ? "s" : "") + " to check on this result.",
  };
}

/* ----------------------------------------------------------- disclosure */

export const VIRTUALLY_STAGED_LABEL = "Virtually Staged";

export const MLS_DISCLOSURE =
  "This photograph has been virtually staged. Furniture and décor shown are digital renderings and are not included in the sale.";

export function needsDisclosure(purposeId?: string | null): boolean {
  return purpose(purposeId).disclose;
}

/* ---------------------------------------------------------------- brief */

export type StageSettings = {
  mode: StageModeId | string;
  roomType: string | null;
  projectType: "interior" | "exterior" | "garden";
  styleId: string | null;
  styleName: string | null;
  grade: string | null;
  occupancy: OccupancyLevelId | string;
  purpose: PurposeId | string;
  palette: string;
  categories: string[];
  keep: string[];
  remove: string[];
  avoid: string[];
  roomChoices: Record<string, string>;
  freeZones: string[];
  preferredZones: string[];
  notes: string | null;
  /** Property-wide staging direction shared across rooms, when set. */
  propertyDirection?: string | null;
  /** Furniture already used elsewhere in this property, for consistency. */
  consistencyWith?: string[];
  extras: string[];
};

export type StagePayload = {
  mode: StageModeId;
  room_type: string;
  project_type: string;
  style_id: string | null;
  direction: string;
  grade: string;
  occupancy: OccupancyLevelId;
  purpose: PurposeId;
  palette: string;
  categories: string[];
  keep: string[];
  remove: string[];
  avoid: string[];
  room_choices: Record<string, string>;
  free_zones: string[];
  preferred_zones: string[];
  notes: string | null;
  property_direction: string | null;
  consistency_with: string[];
  analysis: RoomAnalysis;
};

export type StageBrief = {
  valid: boolean;
  missing: string[];
  warnings: string[];
  runs: StageRun[];
  credits: number;
  costSentence: string;
  lines: Array<{ k: string; v: string }>;
  disclosure: string | null;
  payload: StagePayload;
};

export type StageBriefInput = StageSettings & {
  hasSource: boolean;
  analysis: RoomAnalysis | null;
};

function clean(list: string[] | null | undefined, max = 20): string[] {
  const seen = new Set<string>();
  return (list || [])
    .map((v) => String(v || "").trim())
    .filter((v) => v && !seen.has(v.toLowerCase()) && (seen.add(v.toLowerCase()), true))
    .slice(0, max);
}

export function buildStageBrief(input: StageBriefInput): StageBrief {
  const mode = stageMode(input.mode);
  const analysis = input.analysis || emptyAnalysis();
  const occ = occupancyLevel(input.occupancy);
  const pur = purpose(input.purpose);
  const pal = palette(input.palette);
  const runs = buildRuns(input.extras);
  const notes = input.notes && input.notes.trim() ? input.notes.trim() : null;

  const missing: string[] = [];
  /* Nothing is ever charged before source validation succeeds. */
  if (!input.hasSource) missing.push("Add A Photo");
  if (!input.roomType) missing.push("Confirm The Room Or Space Type");
  if (!(input.styleId || input.styleName)) missing.push("Choose A Design Style");
  if (analysis.occupancy === "unknown") missing.push("Analyze This Photo");
  if (mode.id === "replace" && !clean(input.remove).length)
    missing.push("Name The Furniture To Replace");
  if (mode.id === "add_items" && !clean(input.categories).length)
    missing.push("Choose The Items To Add");

  const warnings: string[] = [];
  const fit = modeFit(mode.id, input.analysis);
  if (fit.message && fit.level !== "ok") warnings.push(fit.message);
  if (analysis.occupancy !== "unknown" && analysis.confidence > 0 && analysis.confidence < 0.5)
    warnings.push("The photo analysis was not confident. Check the room type and occupancy above.");
  const keep = clean(input.keep);
  const remove = clean(input.remove);
  const overlap = keep.filter((k) => remove.some((r) => r.toLowerCase() === k.toLowerCase()));
  if (overlap.length) warnings.push('"' + overlap.join('", "') + '" is marked both Keep and Remove.');

  const roomChoices: Record<string, string> = {};
  roomOptions(input.roomType).forEach((o) => {
    const v = (input.roomChoices || {})[o.id];
    roomChoices[o.id] = v && o.choices.includes(v) ? v : o.fallback;
  });

  const lines: Array<{ k: string; v: string }> = [
    { k: "Tool", v: "Virtual Stage" },
    { k: "Staging Mode", v: mode.label + " — " + mode.blurb },
    { k: "Room", v: input.roomType || "Not Set" },
    { k: "Detected", v: occupancyLabel(analysis.occupancy) + (analysis.summary ? " · " + analysis.summary : "") },
    { k: "Design Style", v: input.styleName || input.styleId || "Not Selected" },
    { k: "Furniture Grade", v: input.grade || "Retail Grade" },
    { k: "Occupancy", v: occ.label + " — " + occ.blurb },
    { k: "Purpose", v: pur.label },
    { k: "Palette", v: pal.label },
  ];
  const cats = clean(input.categories, 24);
  if (cats.length) lines.push({ k: "Furniture Categories", v: cats.join(", ") });
  Object.keys(roomChoices).forEach((id) => {
    const opt = roomOptions(input.roomType).find((o) => o.id === id);
    if (opt) lines.push({ k: opt.label, v: roomChoices[id]! });
  });
  if (keep.length) lines.push({ k: "Keep", v: keep.join(", ") });
  if (remove.length) lines.push({ k: "Remove", v: remove.join(", ") });
  const avoid = clean(input.avoid);
  if (avoid.length) lines.push({ k: "Avoid", v: avoid.join(", ") });
  if (input.freeZones?.length)
    lines.push({ k: "Furniture-Free Zones", v: input.freeZones.length + " painted areas" });
  if (input.preferredZones?.length)
    lines.push({ k: "Preferred Placement", v: input.preferredZones.length + " painted areas" });
  if (input.propertyDirection)
    lines.push({ k: "Property Direction", v: String(input.propertyDirection).trim() });
  if (input.consistencyWith?.length)
    lines.push({ k: "Consistent With", v: clean(input.consistencyWith, 10).join(", ") });
  if (notes) lines.push({ k: "Instructions", v: notes });
  lines.push({ k: "Results", v: runs.map((r) => r.label).join(", ") });
  lines.push({ k: "Classification", v: VIRTUALLY_STAGED_LABEL });

  return {
    valid: missing.length === 0,
    missing,
    warnings,
    runs,
    credits: variationCost(runs),
    costSentence: costSentence(runs),
    lines,
    disclosure: pur.disclose ? MLS_DISCLOSURE : null,
    payload: {
      mode: mode.id,
      room_type: input.roomType || "",
      project_type: input.projectType || "interior",
      style_id: input.styleId || null,
      direction: input.styleName || input.styleId || "",
      grade: input.grade || "Retail Grade",
      occupancy: occ.id,
      purpose: pur.id,
      palette: pal.id,
      categories: cats,
      keep,
      remove,
      avoid,
      room_choices: roomChoices,
      free_zones: clean(input.freeZones, 24),
      preferred_zones: clean(input.preferredZones, 24),
      notes,
      property_direction: input.propertyDirection ? String(input.propertyDirection).trim() : null,
      consistency_with: clean(input.consistencyWith, 10),
      analysis,
    },
  };
}

/** A stable identity for "this exact staging job", used for retry and dedupe. */
export function stageBriefKey(b: StageBrief, runId?: string): string {
  const p = b.payload;
  return [
    "stage",
    runId || "primary",
    p.mode,
    p.room_type,
    p.style_id || p.direction,
    p.grade,
    p.occupancy,
    p.purpose,
    p.palette,
    p.categories.join("|"),
    p.keep.join("|"),
    p.remove.join("|"),
    p.avoid.join("|"),
    Object.keys(p.room_choices).sort().map((k) => k + "=" + p.room_choices[k]).join("|"),
    p.free_zones.join("|"),
    p.preferred_zones.join("|"),
    p.notes || "",
  ]
    .join("~")
    .toLowerCase();
}

/* ---------------------------------------------------------- model prompt */

/**
 * The staging instruction. It is built from the detected geometry and the
 * user's real choices — never a generic "add furniture" sentence.
 */
export function stagePromptLines(p: StagePayload, run?: StageRun | null): string[] {
  const mode = stageMode(p.mode);
  const occ = occupancyLevel(p.occupancy);
  const pur = purpose(p.purpose);
  const pal = palette(p.palette);
  const a = p.analysis || emptyAnalysis();
  const room = p.room_type || "room";

  const lines: string[] = [
    `Virtually stage this photograph of a real ${room}. ${STAGE_PROMISE}`,
    `Staging mode — ${mode.label}: ${mode.directive}`,
  ];

  if (a.occupancy !== "unknown")
    lines.push(
      `The photograph was analyzed as ${occupancyLabel(a.occupancy).toLowerCase()}.` +
        (a.summary ? ` ${a.summary}` : ""),
    );
  if (a.features.length)
    lines.push(
      "Detected architecture that must be respected and left unchanged: " +
        a.features.map((f) => FEATURE_LABEL[f].toLowerCase()).join(", ") +
        ". Place furniture around these, never over them.",
    );
  if (a.zones.length) lines.push("Usable furniture zones in this photograph: " + a.zones.join("; ") + ".");
  if (a.furniture.length)
    lines.push(
      "Existing items visible in the photograph: " +
        a.furniture.join(", ") +
        (mode.removesExisting
          ? ". Handle them exactly as the staging mode above requires."
          : ". Keep every one of them exactly as photographed."),
    );

  lines.push(
    `Design direction: ${p.direction || "a cohesive contemporary direction"} with ${p.grade} furniture.`,
    occ.rule,
    pur.rule,
    `Palette: ${pal.rule}`,
  );

  if (p.categories.length)
    lines.push("Furniture and décor categories to include: " + p.categories.join(", ") + ".");
  Object.keys(p.room_choices || {}).forEach((id) => {
    const opt = roomOptions(p.room_type).find((o) => o.id === id);
    const val = p.room_choices[id];
    if (opt && val) lines.push(opt.rule(val));
  });

  if (p.keep.length) lines.push("Keep these exactly as photographed: " + p.keep.join(", ") + ".");
  if (p.remove.length)
    lines.push(
      "Remove these and rebuild the surfaces behind them plausibly: " + p.remove.join(", ") + ".",
    );
  if (p.avoid.length) lines.push("Do not add any of these: " + p.avoid.join(", ") + ".");

  const free = describeZones(p.free_zones);
  if (free) lines.push("Furniture-free zones — leave these areas of the frame completely clear of furniture: " + free + ".");
  const pref = describeZones(p.preferred_zones);
  if (pref) lines.push("Preferred placement zones — concentrate the main furniture here: " + pref + ".");

  if (p.property_direction)
    lines.push("Property-wide staging direction: " + p.property_direction + ".");
  if (p.consistency_with?.length)
    lines.push(
      "Furniture consistency: this room belongs to the same staged property as " +
        p.consistency_with.join(", ") +
        ". Reuse the same palette, wood tone and metal finish so the rooms read as one home.",
    );

  lines.push("Placement rules — all of these are mandatory: " + PLACEMENT_RULES.join(" "));
  lines.push(
    "Camera, focal length, perspective, framing, exposure and white balance stay identical to the source photograph. " +
      "This is the same photograph with furniture added, not a new rendering of a similar room.",
  );
  lines.push(
    "Photorealistic output: real product photography quality, correct depth of field, natural light behaviour. " +
      "No people, no pets, no text, no logos, no watermarks, no labels.",
  );

  if (run && run.directive) lines.push("Variation for this result — " + run.label + ": " + run.directive);
  if (p.notes) lines.push("Owner instructions: " + p.notes);
  return lines;
}

export function stagePrompt(p: StagePayload, run?: StageRun | null): string {
  return stagePromptLines(p, run).join("\n");
}
