/**
 * The Redesign brief.
 *
 * One pure module owns everything that must be true BEFORE a credit is spent:
 * intensity, Reality Lock, keep/replace/remove, style requirement, conflict
 * detection, credit cost and the human-readable brief the user confirms.
 *
 * It is deliberately free of DOM and network access so the client panel, the
 * generation handler and the server prompt all read the same definitions, and
 * so every rule here is unit-testable.
 */

/* ------------------------------------------------------------ intensity */

export type IntensityId = "refresh" | "makeover" | "renovation" | "reimagine";

export type IntensityLevel = {
  id: IntensityId;
  label: string;
  /** Plain-language explanation of what this level permits. */
  blurb: string;
  /** What the model may change. */
  allows: string[];
  /** What the model must leave alone at this level. */
  preserves: string[];
};

export const INTENSITY_LEVELS: IntensityLevel[] = [
  {
    id: "refresh",
    label: "Refresh",
    blurb: "Cosmetic only. Paint, lighting fixtures, textiles and décor change; nothing is torn out.",
    allows: ["paint", "lighting fixtures", "textiles", "décor", "minor cosmetic updates"],
    preserves: ["flooring", "cabinetry", "counters", "permanent fixtures"],
  },
  {
    id: "makeover",
    label: "Makeover",
    blurb: "Furnishings and surfaces change, including flooring and paint. Architecture stays put.",
    allows: [
      "cosmetic updates",
      "furniture",
      "flooring",
      "paint",
      "lighting",
      "selected surface changes",
    ],
    preserves: ["structural architecture"],
  },
  {
    id: "renovation",
    label: "Renovation",
    blurb: "A real renovation: cabinetry, counters, fixtures, wall finishes and built-ins can all be replaced.",
    allows: ["cabinetry", "counters", "flooring", "fixtures", "wall finishes", "built-ins"],
    preserves: ["the structural shell"],
  },
  {
    id: "reimagine",
    label: "Reimagine",
    blurb:
      "A major nonstructural transformation with wider finish, furnishing and layout freedom. Walls, doors and windows still stay where they are.",
    allows: [
      "major nonstructural visual transformation",
      "wider finish recommendations",
      "wider furnishing recommendations",
      "layout recommendations",
    ],
    preserves: ["walls", "doors", "windows", "structural elements"],
  },
];

export const DEFAULT_INTENSITY: IntensityId = "makeover";

export function intensityById(id?: string | null): IntensityLevel {
  const key = String(id || "").trim().toLowerCase();
  return (
    INTENSITY_LEVELS.find((l) => l.id === key) ||
    INTENSITY_LEVELS.find((l) => l.label.toLowerCase() === key) ||
    INTENSITY_LEVELS.find((l) => l.id === DEFAULT_INTENSITY)!
  );
}

/** The sentence the model is given for the chosen level. */
export function intensityRule(id?: string | null): string {
  const lv = intensityById(id);
  return (
    `${lv.label} intensity: you may change ${lv.allows.join(", ")}. ` +
    `Preserve ${lv.preserves.join(", ")} unless the owner explicitly asked otherwise.`
  );
}

/* --------------------------------------------------------- reality lock */

export type LockElementId =
  | "camera"
  | "focal_length"
  | "perspective"
  | "framing"
  | "dimensions"
  | "ceiling_height"
  | "walls"
  | "windows"
  | "doors"
  | "stairs"
  | "columns"
  | "openings"
  | "plumbing"
  | "roofline"
  | "footprint";

export type LockElement = {
  id: LockElementId;
  label: string;
  /** Only some elements may be unlocked; camera and perspective never can. */
  unlockable: boolean;
  /** Which spaces the element is relevant to. */
  spaces: Array<"interior" | "exterior" | "garden">;
};

export const LOCK_ELEMENTS: LockElement[] = [
  { id: "camera", label: "Camera Position", unlockable: false, spaces: ["interior", "exterior", "garden"] },
  { id: "focal_length", label: "Focal Length", unlockable: false, spaces: ["interior", "exterior", "garden"] },
  { id: "perspective", label: "Perspective", unlockable: false, spaces: ["interior", "exterior", "garden"] },
  { id: "framing", label: "Image Framing", unlockable: false, spaces: ["interior", "exterior", "garden"] },
  { id: "dimensions", label: "Room Dimensions", unlockable: false, spaces: ["interior"] },
  { id: "ceiling_height", label: "Ceiling Height", unlockable: true, spaces: ["interior"] },
  { id: "walls", label: "Wall Placement", unlockable: true, spaces: ["interior", "exterior"] },
  { id: "windows", label: "Windows", unlockable: true, spaces: ["interior", "exterior"] },
  { id: "doors", label: "Doors", unlockable: true, spaces: ["interior", "exterior"] },
  { id: "stairs", label: "Stairs", unlockable: true, spaces: ["interior", "exterior"] },
  { id: "columns", label: "Structural Columns", unlockable: false, spaces: ["interior", "exterior"] },
  { id: "openings", label: "Permanent Openings", unlockable: true, spaces: ["interior", "exterior"] },
  { id: "plumbing", label: "Plumbing Fixture Locations", unlockable: true, spaces: ["interior"] },
  { id: "roofline", label: "Exterior Roofline", unlockable: true, spaces: ["exterior"] },
  { id: "footprint", label: "Property Footprint", unlockable: false, spaces: ["exterior", "garden"] },
];

/** Honest copy. A generative model cannot guarantee pixel-perfect structure. */
export const REALITY_LOCK_DISCLOSURE =
  "Reality Lock strongly guides the generation to preserve the photographed structure. Always verify critical construction details.";

export const STRUCTURE_DRIFT_WARNING = "Structure may have changed";

/** Only elements the user is actually allowed to unlock survive. */
export function sanitizeUnlocked(unlocked: string[] | null | undefined): LockElementId[] {
  const allowed = new Set(LOCK_ELEMENTS.filter((e) => e.unlockable).map((e) => e.id));
  const seen = new Set<string>();
  return (unlocked || [])
    .map((u) => String(u || "").trim().toLowerCase())
    .filter((u) => allowed.has(u as LockElementId) && !seen.has(u) && (seen.add(u), true))
    .map((u) => u as LockElementId);
}

export function lockedElements(unlocked: string[] | null | undefined): LockElement[] {
  const off = new Set<string>(sanitizeUnlocked(unlocked));
  return LOCK_ELEMENTS.filter((e) => !off.has(e.id));
}

export function lockElementsForSpace(space: string): LockElement[] {
  const sp = space === "exterior" ? "exterior" : space === "garden" || space === "landscape" ? "garden" : "interior";
  return LOCK_ELEMENTS.filter((e) => e.spaces.includes(sp as any));
}

/* ------------------------------------------------ keep / replace / remove */

export type ItemState = "keep" | "replace" | "remove" | "none";

export type ItemSource = "detected" | "manual" | "text";

export type BriefItem = { label: string; state: ItemState; source: ItemSource };

export type ItemMap = Record<string, BriefItem>;

function itemKey(label: string): string {
  return String(label || "").trim().toLowerCase();
}

/** One item holds exactly one state; setting a new state replaces the old. */
export function setItemState(
  map: ItemMap,
  label: string,
  state: ItemState,
  source: ItemSource = "manual",
): ItemMap {
  const key = itemKey(label);
  if (!key) return map;
  const next: ItemMap = { ...map };
  if (state === "none") delete next[key];
  else next[key] = { label: String(label).trim(), state, source };
  return next;
}

export function itemState(map: ItemMap, label: string): ItemState {
  return map[itemKey(label)]?.state || "none";
}

export type ItemGroups = { keep: string[]; replace: string[]; remove: string[] };

export function itemGroups(map: ItemMap): ItemGroups {
  const groups: ItemGroups = { keep: [], replace: [], remove: [] };
  Object.values(map).forEach((i) => {
    if (i.state === "keep" || i.state === "replace" || i.state === "remove") groups[i.state].push(i.label);
  });
  (Object.keys(groups) as Array<keyof ItemGroups>).forEach((k) => groups[k].sort());
  return groups;
}

/* ------------------------------------------------------------ conflicts */

const REPLACE_VERBS = /\b(replace|swap|change|update|redo|rip out|tear out|new)\b/i;
const REMOVE_VERBS = /\b(remove|delete|get rid of|take out|clear out)\b/i;
const KEEP_VERBS = /\b(keep|preserve|retain|leave|do not change|don't change|dont change)\b/i;

export type Conflict = { item: string; state: ItemState; message: string };

/**
 * Structured choices win over prose, but the user must see the disagreement
 * before spending a credit.
 */
export function detectConflicts(map: ItemMap, notes: string | null | undefined): Conflict[] {
  const text = String(notes || "");
  if (!text.trim()) return [];
  const out: Conflict[] = [];
  Object.values(map).forEach((item) => {
    const key = itemKey(item.label);
    if (!key) return;
    /* Look at the clause that mentions the item, not the whole note. */
    const clauses = text.split(/[.;,\n]/).filter((c) => c.toLowerCase().includes(key));
    if (!clauses.length) return;
    const says = (re: RegExp) => clauses.some((c) => re.test(c));
    if (item.state === "keep" && (says(REPLACE_VERBS) || says(REMOVE_VERBS)))
      out.push({
        item: item.label,
        state: item.state,
        message: `You marked "${item.label}" as Keep, but your instructions ask to change or remove it.`,
      });
    if ((item.state === "replace" || item.state === "remove") && says(KEEP_VERBS))
      out.push({
        item: item.label,
        state: item.state,
        message: `You marked "${item.label}" as ${item.state === "replace" ? "Replace" : "Remove"}, but your instructions ask to keep it.`,
      });
  });
  return out;
}

/* ---------------------------------------------------------------- brief */

export type BriefInput = {
  tool: string;
  projectType: "interior" | "exterior" | "garden";
  roomType: string | null;
  styleId: string | null;
  styleName: string | null;
  intensity: IntensityId | string | null;
  grade: string | null;
  items: ItemMap;
  notes: string | null;
  unlocked: string[];
  aspectRatio: string | null;
  credits: number;
  /** Whether a usable source image is on the canvas. */
  hasSource: boolean;
  /** Whether this tool requires a deliberate style selection. */
  requiresStyle?: boolean;
};

export type Brief = {
  valid: boolean;
  missing: string[];
  conflicts: Conflict[];
  credits: number;
  intensity: IntensityLevel;
  groups: ItemGroups;
  lines: Array<{ k: string; v: string }>;
  lockDisclosure: string;
  unlocked: LockElementId[];
  /** Exactly what the generation request will carry. */
  payload: {
    tool: string;
    project_type: string;
    room_type: string;
    style_id: string | null;
    direction: string;
    intensity: string;
    intensity_id: IntensityId;
    grade: string;
    notes: string | null;
    keep: string[];
    replace: string[];
    remove: string[];
    unlocked: LockElementId[];
    preserve_architecture: boolean;
    aspect_ratio: string;
  };
};

/** Style ids arrive slugged; the brief shows them the way the UI does. */
function titleCase(v: string): string {
  return String(v)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildBrief(input: BriefInput): Brief {
  const intensity = intensityById(input.intensity);
  const groups = itemGroups(input.items);
  const unlocked = sanitizeUnlocked(input.unlocked);
  const requiresStyle = input.requiresStyle !== false;
  const notes = input.notes && input.notes.trim() ? input.notes.trim() : null;

  const missing: string[] = [];
  if (!input.hasSource) missing.push("Add A Photo");
  if (!input.roomType) missing.push("Confirm The Room Or Space Type");
  if (requiresStyle && !(input.styleId || input.styleName)) missing.push("Choose A Design Style");

  const conflicts = detectConflicts(input.items, notes);

  const lines: Array<{ k: string; v: string }> = [
    { k: "Tool", v: input.tool },
    {
      k: "Project Type",
      v:
        input.projectType === "exterior"
          ? "Exterior"
          : input.projectType === "garden"
            ? "Landscaping"
            : "Interior",
    },
    { k: "Space", v: input.roomType || "Not Set" },
    { k: "Design Style", v: titleCase(input.styleName || input.styleId || "Not Selected") },
    { k: "Intensity", v: intensity.label + " — " + intensity.blurb },
    { k: "Finish Grade", v: input.grade || "Retail Grade" },
    {
      k: "Reality Lock",
      v: unlocked.length
        ? "On, unlocked: " +
          unlocked.map((u) => LOCK_ELEMENTS.find((e) => e.id === u)?.label || u).join(", ")
        : "On for camera, framing and structure",
    },
    { k: "Output", v: !input.aspectRatio || input.aspectRatio === "original" ? "Same Aspect Ratio As The Source" : input.aspectRatio },
  ];
  if (groups.keep.length) lines.push({ k: "Keep", v: groups.keep.join(", ") });
  if (groups.replace.length) lines.push({ k: "Replace", v: groups.replace.join(", ") });
  if (groups.remove.length) lines.push({ k: "Remove", v: groups.remove.join(", ") });
  if (notes) lines.push({ k: "Instructions", v: notes });

  return {
    valid: missing.length === 0,
    missing,
    conflicts,
    credits: Math.max(0, Number(input.credits) || 0),
    intensity,
    groups,
    lines,
    lockDisclosure: REALITY_LOCK_DISCLOSURE,
    unlocked,
    payload: {
      tool: input.tool,
      project_type: input.projectType,
      room_type: input.roomType || "",
      style_id: input.styleId || null,
      direction: input.styleName || input.styleId || "",
      intensity: intensity.label,
      intensity_id: intensity.id,
      grade: input.grade || "Retail Grade",
      notes,
      keep: groups.keep,
      replace: groups.replace,
      remove: groups.remove,
      unlocked,
      preserve_architecture: true,
      aspect_ratio: input.aspectRatio || "original",
    },
  };
}

/* ---------------------------------------------------------- submit guard */

/**
 * A generation runs once per confirmation. The guard is the single place that
 * decides whether a click may start work, so a double click, a re-entrant
 * handler and a keyboard repeat all collapse into one job.
 */
export class SubmitGuard {
  private running = false;
  private lastToken: string | null = null;

  get busy(): boolean {
    return this.running;
  }

  /** Returns false when a job is already in flight or this token already ran. */
  begin(token?: string | null): boolean {
    if (this.running) return false;
    if (token && token === this.lastToken) return false;
    this.running = true;
    if (token) this.lastToken = token;
    return true;
  }

  end() {
    this.running = false;
  }

  /** A failed job may be retried with the same token. */
  reset() {
    this.running = false;
    this.lastToken = null;
  }
}

/* --------------------------------------------------- storage retry state */

export type PendingPersist = {
  /** The completed, already paid for image. */
  image: string;
  briefKey: string;
  attempts: number;
};

/**
 * When generation succeeded but persistence failed, Retry must reuse the image
 * instead of paying for a second render.
 */
export function persistRetryPlan(pending: PendingPersist | null): {
  action: "persist_only" | "generate";
  charge: boolean;
  image: string | null;
} {
  if (pending && pending.image) return { action: "persist_only", charge: false, image: pending.image };
  return { action: "generate", charge: true, image: null };
}

/** A stable key for "the same brief", used for regenerate and retry. */
export function briefKey(b: Brief): string {
  const p = b.payload;
  return [
    p.tool,
    p.project_type,
    p.room_type,
    p.style_id || p.direction,
    p.intensity_id,
    p.grade,
    p.aspect_ratio,
    p.keep.join("|"),
    p.replace.join("|"),
    p.remove.join("|"),
    p.unlocked.join("|"),
    p.notes || "",
  ]
    .join("~")
    .toLowerCase();
}
